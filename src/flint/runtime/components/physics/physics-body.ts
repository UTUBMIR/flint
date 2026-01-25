import * as P from "../../../public/planck";
import { NonSerialized } from "../../../shared/metadata";

import Component from "../../component";
import type { PhysicsWorld } from "../../physics-world";
import { System } from "../../system";

export default class PhysicsBody extends Component {
    @NonSerialized()
    public body!: P.Body;

    public type: "dynamic" | "static" | "kinematic" = "dynamic";

    public mass: number = 1;

    public override attach(): void {
        const pos = this.transform.position;

        this.body = (System.world as PhysicsWorld).physicsWorld.createBody({
            type: this.type,
            position: pos.copy(),
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
        this.transform.position.set(p.x, p.y);
        this.transform.rotation = this.body.getAngle();

        this.body.setMassData({
            mass: this.mass,
            center: this.body.getLocalCenter(),
            I: this.body.getInertia()
        });
    }

    public override detach(): void {
        (System.world as PhysicsWorld).physicsWorld.destroyBody(this.body);
    }
}