
import type { IRenderer } from "../../shared/irenderer";
import type { ColorString } from "../../shared/graphics";
import { FieldRenderer } from "../../editor/component-builder";
import Vector2 from "../../shared/vector2";
import RendererComponent from "../renderer-component";

export default class Shape extends RendererComponent {
    @FieldRenderer("color")
    private fillColor: ColorString = "#cfd2ee";

    @FieldRenderer("color")
    private lineColor: ColorString = "#2e69b6";

    @FieldRenderer("color")
    private shadowColor: ColorString = "#1c649b";

    public override render(renderer: IRenderer): void {
        renderer.fillColor = this.fillColor;
        renderer.lineColor = this.lineColor;
        renderer.lineWidth = 5;
        renderer.lineJoin = "bevel";


        renderer.translate(this.transform.position);
        renderer.rotate(this.transform.angle);
        renderer.translate(Vector2.zero.subtract(this.transform.position));

        renderer.shadowColor = this.shadowColor;
        renderer.shadowBlur = 20;

        renderer.fillRect(this.transform.position.subtract(this.transform.size.divide(2)), this.transform.size);

        renderer.strokeRect(this.transform.position.subtract(this.transform.size.divide(2)), this.transform.size);


        renderer.translate(this.transform.position);
        renderer.rotate(-this.transform.angle);
        renderer.translate(Vector2.zero.subtract(this.transform.position));
    }
}