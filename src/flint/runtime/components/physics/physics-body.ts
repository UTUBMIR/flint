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

    private get world(): PhysicsWorld {
        return System.world as PhysicsWorld;
    }

    private toPhysicsVector(x: number, y: number): P.Vec2 {
        const world = this.world;
        return Planck.Vec2(world.toPhysicsUnits(x), world.toPhysicsUnits(y));
    }

    public override attach(): void {
        const world = this.world;
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
    }

    public override update(): void {
        if (this.type !== "dynamic") return;

        const p = this.body.getPosition();
        this.transform.position.set(
            p.x,
            p.y
        );
        this.transform.rotation = this.body.getAngle();

        this.body.setMassData({
            mass: this.mass,
            center: this.body.getLocalCenter(),
            I: this.body.getInertia()
        });
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

    public override detach(): void {
        this.world.physicsWorld.destroyBody(this.body);
    }
}
