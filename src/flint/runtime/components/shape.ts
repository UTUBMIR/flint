import Component from "../component";
import type { IRenderer } from "../../shared/irenderer";
import Vector2D from "../../shared/vector2d";
import type { Color } from "../../shared/graphics";

export default class Shape extends Component {
    private fillColor: Color = "#294a31";

    onRender(renderer: IRenderer): void {
        renderer.fillColor = this.fillColor;
        renderer.lineColor = "#a8a25d";
        renderer.lineWidth = 5;
        renderer.lineJoin = "bevel";

        renderer.shadowColor = "#34a838";
        renderer.shadowBlur = 20;

        renderer.strokeRect(this.parent.transform.position, new Vector2D(100, 100));
        renderer.fillRect(this.parent.transform.position, new Vector2D(100, 100));
    }
}