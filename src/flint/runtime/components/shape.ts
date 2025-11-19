import Component from "../component.js";
import type { IRenderer } from "../../shared/irenderer.js";
import Vector2D from "../../shared/vector2d.js";
import Input from "../../shared/input.js";
import { System } from "../system.js";

export default class Shape extends Component {
    onUpdate(): void {
        const speed = new Vector2D(Input.getAxis("horizontal"), Input.getAxis("vertical"))
            .multiply(System.deltaTime * 80)
            .normalize(System.deltaTime * 800);

        this.parent.transform.position = this.parent.transform.position.add(speed);
    }

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