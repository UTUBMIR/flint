import Component from "../component.js";
import type { IRenderer } from "../../shared/irenderer.js";
import Vector2D from "../../shared/vector2d.js";
import Input from "../../shared/input.js";
import { System } from "../system.js";

export default class Shape extends Component {
    onRender(renderer: IRenderer): void {
        renderer.fillColor = "#292e4a";
        renderer.lineColor = "#5d68a8";
        renderer.lineWidth = 5;
        renderer.lineJoin = "bevel";

        renderer.shadowColor = "#3446a8";
        renderer.shadowBlur = 20;

        const speed = new Vector2D(Input.getAxis("horizontal"), Input.getAxis("vertical"))
            .multiply(System.deltaTime * 80)
            .normalize(System.deltaTime * 800);

        this.parent.transform.position = this.parent.transform.position.add(speed);

        renderer.strokeRect(this.parent.transform.position, new Vector2D(100, 100));
        renderer.fillRect(this.parent.transform.position, new Vector2D(100, 100));
    }
}