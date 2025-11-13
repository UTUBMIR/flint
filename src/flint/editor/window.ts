import type { IRenderer } from "../shared/irenderer.js";
import Vector2D from "../shared/vector2d.js";

const windowColor = "#292e4a";
const windowEdgeColor = "#5d68a8";
const windowShadowColor = "#3446a8";

export default class Window {
    public position: Vector2D;
    public size: Vector2D;

    public constructor(position?: Vector2D, size?: Vector2D) {
        this.position = position??new Vector2D();
        this.size = size??new Vector2D(100, 100);
    }

    public onUpdate() {

    }

    public onRender(renderer: IRenderer) {
        renderer.fillColor = windowColor;
        renderer.lineColor = windowEdgeColor;
        renderer.lineWidth = 5;
        renderer.lineJoin = "bevel";

        renderer.shadowColor = windowShadowColor;
        renderer.shadowBlur = 20;

        renderer.rect(this.position, this.size);
        renderer.strokeRect(this.position, this.size);
    }
}