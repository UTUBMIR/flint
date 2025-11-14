import type { ILayer } from "../../shared/ilayer.js";
import type { IRenderer } from "../../shared/irenderer.js";
import Vector2D from "../../shared/vector2d.js";
import Window from "../window.js";

export default class Viewport extends Window {
    public layer: ILayer | undefined;
    protected minSize: Vector2D = new Vector2D(250, 100);

    constructor(position?: Vector2D, size?: Vector2D, layer?: ILayer) {
        super(position, size, "Viewport");
        this.layer = layer;
    }

    public onAttach(): void {
    }
    public onUpdate(): void {
        if (this.layer) {
            this.layer.canvas.element.style.left = this.position.x + "px";
            this.layer.canvas.element.style.top = (this.position.y + Window.titleBarHeight) + "px";
            this.layer.canvas.element.width = this.size.x;
            this.layer.canvas.element.height = this.size.y - Window.titleBarHeight;
        }
    }
    public onContentRender(r: IRenderer): void {
        if (!this.layer) {
            r.fontSize = 24;
            r.textBaseLine = "middle";
            r.textAlign = "center";
            r.fillText(new Vector2D(this.size.x / 2, (this.size.y + Window.titleBarHeight) / 2).add(this.position), "No layer connected");
        }
    }
}