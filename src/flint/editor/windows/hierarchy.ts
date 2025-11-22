import Layer from "../../runtime/layer.js";
import type { IRenderer } from "../../shared/irenderer.js";
import Vector2D from "../../shared/vector2d.js";
import Window from "../window.js";
import { Button, Tree } from "../interaction.js";
import type { SystemEvent } from "../../runtime/system-event.js";
import { Rect } from "../../shared/primitives.js";
import { System } from "../../runtime/system.js";
import visualsConfig from "../config/visuals.json" with { type: 'json' };
import type { Color } from "../../shared/graphics.js";
import type GameObject from "../../runtime/game-object.js";
import Input from "../../shared/input.js";


export default class Hierarchy extends Window {
    protected minSize: Vector2D = new Vector2D(250, 100);
    private tree: Tree = new Tree(this.rect);
    private layers: Layer[] = [];//FIXME: Delete me

    public selectedObject: { button: Button, gameObject: GameObject } | undefined;

    constructor(position?: Vector2D, size?: Vector2D) {
        super(position, size, "Hierarchy");
        this.tree.lockState(true);
        this.tree.nestedSpacing = 0;

        this.tree.onRender = this.tree.onRenderContent; //NOTE: only render content, without internal stuff
    }

    public addLayer(layer: Layer): void {
        const tree = new Tree(new Rect(0, 0, 0, 20), "new " + layer.constructor.name);
        this.tree.items.unshift(tree);

        for (const gameObject of layer.getObjects()) {
            const button = new Button(new Rect(0, 0, 0, 20), "new " + gameObject.constructor.name);

            button.onClick = () => {
                if (this.selectedObject) {
                    this.selectedObject.button.color = visualsConfig.colors.toolbarTab as Color;
                }
                this.selectedObject = { button, gameObject };
            };

            tree.items.unshift(button);
        }

        this.layers.unshift(layer);
    }

    public onAttach(): void {
    }

    public onUpdate(): void {
        if (System.layers.length - 1 != this.layers.length) {
            const layer = System.layers[this.layers.length + 1];
            if (layer instanceof Layer) {
                this.addLayer(layer); //FIXME: WTF
            }
        }
    }

    public onRenderContent(r: IRenderer): void {
        this.tree.rect = this.rect.copy();
        this.tree.rect.height = 0;
        this.tree.rect.position.y += Window.titleBarHeight;

        if (this.selectedObject) {
            this.selectedObject.button.color = visualsConfig.colors.toolbarTabPressed as Color;
        }

        this.tree.onRender(r);
    }

    public onEvent(event: SystemEvent): void {
        this.tree.onEvent(event);

        if (this.selectedObject && !event.stopImmediate && event.type === "mousedown" && this.rect.contains(Input.mousePosition)) {
            this.selectedObject.button.color = visualsConfig.colors.toolbarTab as Color;
            this.selectedObject = undefined;
        }
    }
}