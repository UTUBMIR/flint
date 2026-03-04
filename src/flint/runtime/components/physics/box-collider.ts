import Planck from "../../../public/planck";
import type { PhysicsWorld } from "../../physics-world";
import { System } from "../../system";

import Collider from "./collider";

export default class BoxCollider extends Collider {
    public override attach(): void {
        const world = System.world as PhysicsWorld;
        this.fixture = this.body.createFixture(
            Planck.Box(
                world.toPhysicsUnits(this.transform.size.x) / 2,
                world.toPhysicsUnits(this.transform.size.y) / 2
            ),
            {
                density: 1,
                friction: 0.3
            }
        );
    }
}
