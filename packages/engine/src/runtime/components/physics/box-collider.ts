import Planck from "@flint/public/planck";

import Collider from "./collider";

export default class BoxCollider extends Collider {
    public override attach(): void {
        this.fixture = this.body.createFixture(
            Planck.Box(
                this.transform.size.x / 2,
                this.transform.size.y / 2
            ),
            {
                density: 1,
                friction: 0.3
            }
        );
    }
}
