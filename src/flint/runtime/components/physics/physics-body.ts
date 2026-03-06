import Planck, * as P from "@flint/public/planck";
import { NonSerialized } from "@flint/shared/metadata";

import Component from "@flint/runtime/component";
import type { PhysicsWorld } from "@flint/runtime/physics-world";
import { System } from "@flint/runtime/system";

export default class PhysicsBody extends Component {
    @NonSerialized()
    public body!: P.Body;

    public type: "dynamic" | "static" | "kinematic" = "dynamic";

    public mass: number = 1;

    @NonSerialized()
    private attachedWorld: PhysicsWorld | undefined;

    @NonSerialized()
    private lastPulledX: number = Number.NaN;

    @NonSerialized()
    private lastPulledY: number = Number.NaN;

    @NonSerialized()
    private lastPulledAngle: number = Number.NaN;

    @NonSerialized()
    private lastAppliedType: PhysicsBody["type"] = this.type;

    @NonSerialized()
    private lastAppliedMass: number = this.mass;

    private get world(): PhysicsWorld {
        return System.world as PhysicsWorld;
    }

    private toPhysicsVector(x: number, y: number): P.Vec2 {
        const world = this.world;
        return Planck.Vec2(world.toPhysicsUnits(x), world.toPhysicsUnits(y));
    }

    private pullStateFromBody(): void {
        const p = this.body.getPosition();
        const angle = this.body.getAngle();

        this.transform.position.set(p.x, p.y);
        this.transform.rotation = angle;

        this.lastPulledX = p.x;
        this.lastPulledY = p.y;
        this.lastPulledAngle = angle;

        const bodyType = this.body.getType() as PhysicsBody["type"];
        if (bodyType !== this.type) {
            this.type = bodyType;
        }
        this.lastAppliedType = this.type;

        if (this.type === "dynamic") {
            const bodyMass = this.body.getMass();
            if (bodyMass !== this.mass && this.mass === this.lastAppliedMass) {
                this.mass = bodyMass;
            }
            this.lastAppliedMass = this.mass;
        }
    }

    private applyFieldsToBody(): void {
        const typeChanged = this.type !== this.lastAppliedType;

        if (typeChanged) {
            this.body.setType(this.type);
            this.lastAppliedType = this.type;
        }

        if (this.type === "dynamic") {
            const shouldApplyMass = typeChanged || this.mass !== this.lastAppliedMass;
            if (shouldApplyMass) {
                this.body.setMassData({
                    mass: this.mass,
                    center: this.body.getLocalCenter(),
                    I: this.body.getInertia()
                });
                this.lastAppliedMass = this.mass;
            }
        }
    }

    private applyTransformToBodyIfChanged(): void {
        const { position, rotation } = this.transform;
        const x = position.x;
        const y = position.y;
        const angle = rotation;

        // If something else modified the transform since the last physics pull,
        // treat the transform as authoritative and push it into the physics body.
        if (x !== this.lastPulledX || y !== this.lastPulledY || angle !== this.lastPulledAngle) {
            this.body.setTransform(Planck.Vec2(x, y), angle);
            this.body.setAwake(true);

            // Prevent re-applying the same transform every frame until the next pull.
            this.lastPulledX = x;
            this.lastPulledY = y;
            this.lastPulledAngle = angle;
        }
    }

    public override attach(): void {
        const world = this.world;
        this.attachedWorld = world;
        const pos = this.transform.position;

        this.body = world.physicsWorld.createBody({
            type: this.type,
            position: Planck.Vec2(
                pos.x,
                pos.y
            ),
            angle: this.transform.rotation
        });

        if (this.type === "dynamic") {
            this.body.setMassData({
                mass: this.mass,
                center: this.body.getLocalCenter(),
                I: this.body.getInertia()
            });
        }

        this.body.setUserData(this);

        this.lastAppliedType = this.type;
        this.lastAppliedMass = this.mass;
        this.lastPulledX = pos.x;
        this.lastPulledY = pos.y;
        this.lastPulledAngle = this.transform.rotation;

        world.registerPhysicsBody(this);
    }

    public override update(): void {
        this.applyTransformToBodyIfChanged();
        this.applyFieldsToBody();
    }

    /**
     * Called by {@link PhysicsWorld} after stepping the physics simulation.
     * Do not call directly.
     */
    public __physicsSyncFromBody(): void {
        this.pullStateFromBody();
    }

    /**
     * Moves the physics body to an absolute world-space position in meters.
     * This updates both the Planck body transform and the game object transform.
     */
    public moveTo(x: number, y: number): void {
        this.body.setTransform(
            Planck.Vec2(x, y),
            this.body.getAngle()
        );
        this.transform.position.set(x, y);
        this.body.setAwake(true);
        this.lastPulledX = x;
        this.lastPulledY = y;
    }

    /**
     * Moves the physics body by a world-space offset in meters.
     */
    public moveBy(x: number, y: number): void {
        const pos = this.body.getPosition();
        this.moveTo(pos.x + x, pos.y + y);
    }

    /**
     * Executes low-level operations directly on the underlying Planck body.
     * Use this for internal or advanced interactions that are not exposed by this wrapper.
     */
    public withBody(action: (body: P.Body) => void): void {
        action(this.body);
        this.body.setAwake(true);
        this.pullStateFromBody();
    }

    /**
     * Sets the body's linear velocity in meters per second.
     * Static bodies ignore this call.
     */
    public setVelocity(velocityX: number, velocityY: number): void {
        if (this.type === "static") {
            return;
        }

        this.body.setLinearVelocity(
            Planck.Vec2(velocityX, velocityY)
        );
        this.body.setAwake(true);
    }

    /**
     * @deprecated Use {@link setVelocity}.
     */
    public ["throw"](velocityX: number, velocityY: number): void {
        this.setVelocity(velocityX, velocityY);
    }

    /**
     * Applies a continuous force to the body.
     * `forceX`/`forceY` are expected in physics units (newtons in Planck world scale).
     * `pointX`/`pointY` are optional world-space coordinates in meters where the force is applied.
     * If point is omitted, force is applied at the center of mass.
     */
    public applyForce(forceX: number, forceY: number, pointX?: number, pointY?: number): void {
        if (this.type === "static") {
            return;
        }

        const force = Planck.Vec2(forceX, forceY);

        if (pointX === undefined || pointY === undefined) {
            this.body.applyForceToCenter(force, true);
            return;
        }

        this.body.applyForce(force, Planck.Vec2(pointX, pointY), true);
    }

    /**
     * Sets the body's angular velocity in radians per second.
     * Static bodies ignore this call.
     */
    public setAngularVelocity(angularVelocity: number): void {
        if (this.type === "static") {
            return;
        }

        this.body.setAngularVelocity(angularVelocity);
        this.body.setAwake(true);
    }

    /**
     * Applies a continuous torque to the body.
     * `torque` is expected in physics units (usually N-m in Planck world scale).
     * Static bodies ignore this call.
     */
    public applyTorque(torque: number): void {
        if (this.type === "static") {
            return;
        }

        this.body.applyTorque(torque, true);
    }

    /**
     * Applies an instantaneous angular impulse to the body.
     * Static bodies ignore this call.
     */
    public applyAngularImpulse(impulse: number): void {
        if (this.type === "static") {
            return;
        }

        this.body.applyAngularImpulse(impulse, true);
    }

    public override detach(): void {
        const world = this.attachedWorld ?? this.world;
        world.unregisterPhysicsBody(this);
        world.physicsWorld.destroyBody(this.body);
        this.attachedWorld = undefined;
    }
}
