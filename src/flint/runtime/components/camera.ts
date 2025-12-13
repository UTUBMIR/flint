import { FieldRenderer } from "../../editor/component-builder";
import type { ColorString } from "../../shared/graphics";
import type Vector2D from "../../shared/vector2d";
import RendererComponent from "../renderer-component";

export default class Camera extends RendererComponent  {
    public enabled: boolean = true;

    @FieldRenderer("color")
    public backgroundColor: ColorString = "#222" as ColorString;

    public get position(): Vector2D {
        return this.transform.position;
    }

    public get angle(): number {
        return this.transform.angle;
    }

    //TODO: implement camera stuff
    attach(): void {
        this.gameObject.layer.cameras.push(this);
    }
}