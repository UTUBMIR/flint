import { FieldRenderer } from "../../editor/component-builder";
import type { ColorString } from "../../shared/graphics";
import type Vector2 from "../../shared/vector2";
import RendererComponent from "../renderer-component";

export default class Camera extends RendererComponent {
    public enabled: boolean = true;

    public constructor(backgroundColor?: ColorString) {
        super();
        this.backgroundColor = backgroundColor ?? "#222" as ColorString;
    }

    @FieldRenderer("color")
    public backgroundColor: ColorString;

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

    public override detach(): void {
        const cameras = this.gameObject.layer.cameras;
        cameras.splice(cameras.indexOf(this), 1);
    }
}