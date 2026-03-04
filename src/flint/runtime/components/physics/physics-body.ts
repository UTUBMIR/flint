import Planck, * as P from "../../../public/planck";
import { NonSerialized } from "../../../shared/metadata";

import Component from "../../component";
import type { PhysicsWorld } from "../../physics-world";
import { System } from "../../system";

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
                world.toPhysicsUnits(pos.x),
                world.toPhysicsUnits(pos.y)
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

        const world = this.world;
        const p = this.body.getPosition();
        this.transform.position.set(
            world.toPixels(p.x),
            world.toPixels(p.y)
        );
        this.transform.rotation = this.body.getAngle();

        this.body.setMassData({
            mass: this.mass,
            center: this.body.getLocalCenter(),
            I: this.body.getInertia()
        });
    }

    /**
     * Moves the physics body to an absolute position in pixels.
     * This updates both the Planck body transform and the game object transform.
     */
    public moveTo(x: number, y: number): void {
        this.body.setTransform(
            this.toPhysicsVector(x, y),
            this.body.getAngle()
        );
        this.transform.position.set(x, y);
        this.body.setAwake(true);
    }

    /**
     * Moves the physics body by an offset in pixels.
     */
    public moveBy(x: number, y: number): void {
        this.moveTo(this.transform.position.x + x, this.transform.position.y + y);
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
     * Applies an instant throw velocity in pixels per second.
     * Static bodies ignore this call.
     */
    public ["throw"](velocityX: number, velocityY: number): void {
        if (this.type === "static") {
            return;
        }

        this.body.setLinearVelocity(
            this.toPhysicsVector(velocityX, velocityY)
        );
        this.body.setAwake(true);
    }

    /**
     * Applies a continuous force to the body.
     * `forceX`/`forceY` are provided in pixel-scaled units and converted to physics units.
     * `pointX`/`pointY` are optional world-space pixel coordinates where the force is applied.
     * If point is omitted, force is applied at the center of mass.
     */
    public applyForce(forceX: number, forceY: number, pointX?: number, pointY?: number): void {
        if (this.type === "static") {
            return;
        }

        const force = this.toPhysicsVector(forceX, forceY);

        if (pointX === undefined || pointY === undefined) {
            this.body.applyForceToCenter(force, true);
            return;
        }

        this.body.applyForce(force, this.toPhysicsVector(pointX, pointY), true);
    }

    public override detach(): void {
        this.world.physicsWorld.destroyBody(this.body);
    }
}
