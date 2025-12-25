import { FieldRenderer } from "../../editor/component-builder";
import type { ColorString } from "../../shared/graphics";
import type Vector2 from "../../shared/vector2";
import RendererComponent from "../renderer-component";

export default class Camera extends RendererComponent  {
    public enabled: boolean = true;

    @FieldRenderer("color")
    public backgroundColor: ColorString = "#222" as ColorString;

    public get position(): Vector2 {
        return this.transform.position;
    }

    public get angle(): number {
        return this.transform.rotation;
    }

    //TODO: implement camera stuff
    public override attach(): void {
        this.gameObject.layer.cameras.push(this);
    }
}