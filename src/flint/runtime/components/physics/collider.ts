import * as P from "../../../public/planck";
import { NonSerialized } from "../../../shared/metadata";

import Component from "../../component";
import PhysicsBody from "./physics-body";

export default abstract class Collider extends Component {
    @NonSerialized()
    protected fixture!: P.Fixture;

    protected get body(): P.Body {
        return this.gameObject.requireComponent(PhysicsBody).body;
    }

    public override detach(): void {
        if (this.fixture) {
            this.body.destroyFixture(this.fixture);
        }
    }
}