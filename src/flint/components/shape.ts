import Component from "../component.js";
import type { IRenderer } from "../irenderer.js";
import Vector2D from "../vector2d.js";
import Transform from "./transform.js";

export default class Shape extends Component {
    private transform!: Transform;

    onAttach(): void {
        this.transform = this.parent.requireComponent(Transform);
    }

    onRender(renderer: IRenderer): void {
        renderer.fillColor = "#ff1111";
        renderer.rect(new Vector2D(this.transform.position.x, this.transform.position.y), new Vector2D(100, 100));
    }
}