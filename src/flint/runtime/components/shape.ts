import Component from "../component";
import type { IRenderer } from "../../shared/irenderer";
import Vector2D from "../../shared/vector2d";

export default class Shape extends Component {
    onRender(renderer: IRenderer): void {
        renderer.fillColor = "#294a31ff";
        renderer.lineColor = "#a8a25dff";
        renderer.lineWidth = 5;
        renderer.lineJoin = "bevel";

        renderer.shadowColor = "#34a838ff";
        renderer.shadowBlur = 20;

        renderer.strokeRect(this.parent.transform.position, new Vector2D(100, 100));
        renderer.fillRect(this.parent.transform.position, new Vector2D(100, 100));
    }
}