import type Layer from "../../runtime/layer.js";
import type { IRenderer } from "../../shared/irenderer.js";
import Vector2D from "../../shared/vector2d.js";
import Window from "../window.js";
import visualsConfig from "../config/visuals.json" with { type: 'json' };
import type { Color } from "../../shared/graphics.js";


export default class Viewport extends Window {
    public layer: Layer | undefined;
    protected minSize: Vector2D = new Vector2D(250, 100);

    constructor(position?: Vector2D, size?: Vector2D, layer?: Layer) {
        super(position, size, "Viewport");
        this.layer = layer;
    }

    public onAttach(): void {
    }
    public onUpdate(): void {
        if (!this.layer) {
            return;
        }

        this.layer.canvas.element.style.left = this.position.x + "px";
        this.layer.canvas.element.style.top = (this.position.y + Window.titleBarHeight) + "px";
        this.layer.canvas.element.width = this.size.x;
        this.layer.canvas.element.height = this.size.y - Window.titleBarHeight;

        if (this.layer.cameras.length === 0) {
            return;
        }
        const camera = this.layer.cameras[0];
        if (!camera) {
            return;
        }

        camera.position.set(this.size.x / -2, this.size.y / -2);//TODO: make support of many cameras

        camera.enabled = !this.dockContainer || this.dockContainer.getActiveWindow() === this;
    }
    public onContentRender(r: IRenderer): void {
        if (this.layer) {
            return;
        }

        r.fillColor = visualsConfig.colors.textColor as Color;
        r.fontSize = 24;
        r.textBaseLine = "middle";
        r.textAlign = "center";
        r.fillText(new Vector2D(this.size.x / 2, (this.size.y + Window.titleBarHeight) / 2).add(this.position), "No layer connected");
    }
}