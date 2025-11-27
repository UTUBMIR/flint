import Component from "../component";
import type { IRenderer } from "../../shared/irenderer";
import type { Color } from "../../shared/graphics";
import { FieldRenderer } from "../../editor/component-builder";
import Vector2D from "../../shared/vector2d";

export default class Shape extends Component {
    @FieldRenderer("color")
    private fillColor: Color = "#294a31";

    onRender(renderer: IRenderer): void {
        renderer.fillColor = this.fillColor;
        renderer.lineColor = "#a8a25d";
        renderer.lineWidth = 5;
        renderer.lineJoin = "bevel";

        renderer.shadowColor = "#34a838";
        renderer.shadowBlur = 20;

        renderer.translate(this.transform.position);
        renderer.rotate(this.transform.angle);
        renderer.translate(Vector2D.zero.subtract(this.transform.position));


        renderer.strokeRect(this.transform.position, this.transform.size);
        renderer.fillRect(this.transform.position, this.transform.size);

        renderer.translate(this.transform.position);
        renderer.rotate(-this.transform.angle);
        renderer.translate(Vector2D.zero.subtract(this.transform.position));
    }
}