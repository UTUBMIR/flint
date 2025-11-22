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
import Component from "../../runtime/component.js";
import Editor from "../editor.js";


export default class Inspector extends Window {
    protected minSize: Vector2D = new Vector2D(250, 100);
    private tree: Tree = new Tree(this.rect);
    private currentObject: GameObject | undefined;

    constructor(position?: Vector2D, size?: Vector2D) {
        super(position, size, "Inspector");
        this.tree.lockState(true);
        this.tree.nestedSpacing = 0;

        this.tree.onRender = this.tree.onRenderContent; //NOTE: only render content, without internal stuff
    }

    public addComponent(component: Component): void {
        const tree = new Tree(new Rect(0, 0, 0, 20), "new " + component.constructor.name);
        this.tree.items.push(tree);
    }

    public onAttach(): void {
    }

    public onUpdate(): void {
        if (Editor.hierarchyWindow.selectedObject?.gameObject != this.currentObject) {
            this.tree.items = [];
            this.currentObject = Editor.hierarchyWindow.selectedObject?.gameObject;
            if (!this.currentObject) return;
            this.addComponent(this.currentObject.transform);

            for (const component of this.currentObject.getAllComponents()) {
                this.addComponent(component);
            }
        }
    }

    public onRenderContent(r: IRenderer): void {
        this.tree.rect = this.rect.copy();
        this.tree.rect.height = 0;
        this.tree.rect.position.y += Window.titleBarHeight;

        this.tree.onRender(r);
    }

    public onEvent(event: SystemEvent): void {
        this.tree.onEvent(event);
    }
}