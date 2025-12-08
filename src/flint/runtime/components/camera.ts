import { customRenderer } from "../../editor/component-builder";
import type { ColorString } from "../../shared/graphics";
import type Vector2D from "../../shared/vector2d";
import Component from "../component";

export default class Camera extends Component  {
    public enabled: boolean = true;

    @customRenderer("color")
    public backgroundColor: ColorString = "#222" as ColorString;

    public get position(): Vector2D {
        return this.transform.position;
    }

    public get angle(): number {
        return this.transform.angle;
    }

    //TODO: implement camera stuff
    onAttach(): void {
        this.parent.layer.cameras.push(this);
    }
}