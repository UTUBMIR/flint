import Component from "../component.js";
import type { IRenderer } from "../../shared/irenderer.js";
import Vector2D from "../../shared/vector2d.js";

export default class Shape extends Component {
    onRender(renderer: IRenderer): void {
        renderer.fillColor = "#292e4a";
        renderer.lineColor = "#5d68a8";
        renderer.lineWidth = 5;
        renderer.lineJoin = "bevel";

        renderer.shadowColor = "#3446a8";
        renderer.shadowBlur = 20;


        renderer.rect(this.parent.transform.position, new Vector2D(100, 100));
        renderer.strokeRect(this.parent.transform.position, new Vector2D(100, 100));
    }
}