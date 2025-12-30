import type { IRenderer } from "../../shared/irenderer";
import type { ColorString } from "../../shared/graphics";
import { FieldRenderer } from "../../editor/component-builder";
import Vector2 from "../../shared/vector2";
import RendererComponent from "../renderer-component";

export default class Shape extends RendererComponent {
    @FieldRenderer("color")
    protected fillColor: ColorString;

    @FieldRenderer("color")
    protected lineColor: ColorString;

    @FieldRenderer("color")
    protected shadowColor: ColorString;

    constructor(fillColor?: ColorString, lineColor?: ColorString, shadowColor?: ColorString) {
        super();
        this.fillColor = fillColor ?? "#cfd2ee";
        this.lineColor = lineColor ?? "#2e69b6";
        this.shadowColor = shadowColor ?? "#1c649b";
    }

    public override render(renderer: IRenderer): void {
        renderer.fillColor = this.fillColor;
        renderer.lineColor = this.lineColor;
        renderer.lineWidth = 4.5;
        renderer.lineJoin = "bevel";


        renderer.translate(this.transform.position);
        renderer.rotate(this.transform.rotation);
        renderer.translate(Vector2.zero.subtract(this.transform.position));

        renderer.shadowColor = this.shadowColor;
        renderer.shadowBlur = 20;

        renderer.fillRect(this.transform.position.copy().subtract(this.transform.size.copy().divide(2)), this.transform.size);

        renderer.strokeRect(this.transform.position.copy().subtract(this.transform.size.copy().divide(2)), this.transform.size);


        renderer.translate(this.transform.position);
        renderer.rotate(-this.transform.rotation);
        renderer.translate(Vector2.zero.subtract(this.transform.position));
    }
}