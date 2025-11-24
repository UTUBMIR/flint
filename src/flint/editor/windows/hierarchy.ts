import type SlTree from "@shoelace-style/shoelace/dist/components/tree/tree.js";
import type Layer from "../../runtime/layer";
import { System } from "../../runtime/system";
import type SlTreeItem from "@shoelace-style/shoelace/dist/components/tree-item/tree-item.component.js";

export default class Hierarchy {
    public element: SlTree;
    public layers = new Map<number, Layer>();

    public constructor(element: SlTree) {
        this.element = element;
    }

    public onUpdate() {
        this.layers.clear();
        for (const [layerIndex, layer] of System.layers.entries()) {
            const name = `new Layer${layerIndex > 0 ? " " + layerIndex : ""}`;

            const layerItem = this.addItem(name, layerIndex.toString(), this.element);
            for (const [index] of layer.getObjects().entries()) {
                const name = `new GameObject${index > 0 ? " " + index : ""}`;

                this.addItem(name, layerIndex.toString() + "-" + index.toString(), layerItem);
            }
            this.layers.set(layerIndex, layer);
        }
    }

    public addItem(text: string, id: string, parent: SlTree | SlTreeItem) {
        const item = Object.assign(document.createElement("sl-tree-item"), {
            textContent: text,
            hierarchyId: id
        });

        parent.appendChild(item);
        return item;
    }
}