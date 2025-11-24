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
import type SlTreeItem from "@shoelace-style/shoelace/dist/components/tree-item/tree-item.component.js";
import type SlTree from "@shoelace-style/shoelace/dist/components/tree/tree.component.js";
import "@shoelace-style/shoelace/dist/components/tree/tree.component.js";


export default class Inspector {
    protected minSize: Vector2D = new Vector2D(250, 100);
    // private tree: Tree = new Tree(this.rect);
    private currentObject: GameObject | undefined;

    private element: SlTree;

    public constructor(element: SlTree) {
        this.element = element;

        Editor.hierarchy.element.addEventListener("sl-selection-change", this.onUpdate.bind(this));
    }

    public addComponent(text: string, id: string, parent: SlTree | SlTreeItem) {
        const item = Object.assign(document.createElement("sl-tree-item"), {
            textContent: text,
            componentId: id
        });

        parent.appendChild(item);
        return item;
    }

    public onUpdate(event: Event) {
        const selection = (event as CustomEvent).detail.selection as SlTreeItem[];
        const parsed = (selection[0]! as unknown as { hierarchyId: string }).hierarchyId

            .split("-")
            .map(i => Number.parseInt(i));

        const layer = Editor.hierarchy.layers.get(parsed[0] ?? 0);
        this.currentObject = layer?.getObjects()[parsed[1] ?? 0];

        this.element.innerHTML = "";

        for (const component of this.currentObject!.getAllComponents()) {
            this.addComponent(component.constructor.name ?? "", "abc", this.element);
        }
    }
}