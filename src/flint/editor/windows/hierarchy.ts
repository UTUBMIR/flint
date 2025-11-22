import Layer from "../../runtime/layer.js";
import type { IRenderer } from "../../shared/irenderer.js";
import Vector2D from "../../shared/vector2d.js";
import Window from "../window.js";
import { Tree } from "../interaction.js";
import type { SystemEvent } from "../../runtime/system-event.js";
import { Rect } from "../../shared/primitives.js";
import { System } from "../../runtime/system.js";


export default class Hierarchy extends Window {
    protected minSize: Vector2D = new Vector2D(250, 100);
    private tree: Tree = new Tree(this.rect);
    private layers: Layer[] = [];

    constructor(position?: Vector2D, size?: Vector2D) {
        super(position, size, "Hierarchy");
        this.tree.lockState(true);
        this.tree.nestedSpacing = 0;

        this.tree.onRender = this.tree.onRenderContent; // only render content, without internal stuff
    }

    public addLayer(layer: Layer): void {
        this.tree.items.push(new Tree(new Rect(0, 0, 0, 20), "new " + layer.constructor.name));
        this.layers.push(layer);
    }

    public onAttach(): void {
    }

    public onUpdate(): void {
        if (System.layers.length - 1 != this.layers.length) {
            const layer = System.layers[System.layers.length-1];
            if (layer instanceof Layer) {
                this.addLayer(layer); // FIXME: WTF
            }
        }
    }

    public onRenderContent(r: IRenderer): void {
        this.tree.rect = this.rect;
        this.rect.height = 0;
        this.rect.position.y += Window.titleBarHeight;

        this.tree.onRender(r);
    }

    public onEvent(event: SystemEvent): void {
        this.tree.onEvent(event);
    }
}