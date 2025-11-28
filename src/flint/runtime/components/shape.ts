import Component from "../component";
import type { IRenderer } from "../../shared/irenderer";
import type { ColorString } from "../../shared/graphics";
import { FieldRenderer } from "../../editor/component-builder";
import Vector2D from "../../shared/vector2d";

export default class Shape extends Component {
    @FieldRenderer("color")
    private fillColor: ColorString = "#294a31";

    @FieldRenderer("color")
    private lineColor: ColorString = "#a8a25d";

    @FieldRenderer("color")
    private shadowColor: ColorString = "#34a838";

    onRender(renderer: IRenderer): void {
        renderer.fillColor = this.fillColor;
        renderer.lineColor = this.lineColor;
        renderer.lineWidth = 5;
        renderer.lineJoin = "bevel";


        renderer.translate(this.transform.position);
        renderer.rotate(this.transform.angle);
        renderer.translate(Vector2D.zero.subtract(this.transform.position));

        renderer.shadowColor = this.shadowColor;
        renderer.shadowBlur = 20;

        renderer.fillRect(this.transform.position, this.transform.size);

        renderer.strokeRect(this.transform.position, this.transform.size);


        renderer.translate(this.transform.position);
        renderer.rotate(-this.transform.angle);
        renderer.translate(Vector2D.zero.subtract(this.transform.position));
    }
}