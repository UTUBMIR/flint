import type { IRenderer } from "../../shared/irenderer";
import type { ColorString } from "../../shared/graphics";
import { FieldRenderer } from "../../editor/component-builder";
import Vector2 from "../../shared/vector2";
import RendererComponent from "../renderer-component";

export default class Label extends RendererComponent {
    @FieldRenderer("color")
    protected fillColor: ColorString;

    @FieldRenderer("color")
    protected lineColor: ColorString;

    @FieldRenderer("color")
    protected shadowColor: ColorString;

    public text: string = "Label text";

    constructor(fillColor?: ColorString, lineColor?: ColorString, shadowColor?: ColorString) {
        super();
        this.fillColor = fillColor ?? "#cfd2ee";
        this.lineColor = lineColor ?? "#2e2eb6ff";
        this.shadowColor = shadowColor ?? "#1c259bff";
    }

    public override render(renderer: IRenderer): void {
        renderer.fillColor = this.fillColor;
        renderer.lineColor = this.lineColor;
        renderer.lineWidth = 1;
        renderer.lineJoin = "bevel";


        renderer.translate(this.transform.position);
        renderer.rotate(this.transform.rotation);
        renderer.translate(Vector2.zero.subtract(this.transform.position));

        renderer.shadowColor = this.shadowColor;
        renderer.shadowBlur = 20;

        renderer.fillText(this.transform.position.copy().subtract(this.transform.size.copy().divide(2)), this.text);

        renderer.strokeText(this.transform.position.copy().subtract(this.transform.size.copy().divide(2)), this.text);


        renderer.translate(this.transform.position);
        renderer.rotate(-this.transform.rotation);
        renderer.translate(Vector2.zero.subtract(this.transform.position));
    }
}