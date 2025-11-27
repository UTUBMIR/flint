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

        const treeItems = document.querySelectorAll("sl-tree-item");

        treeItems.forEach(item => {
            item.addEventListener("dblclick", async () => {
                // Prevent multiple inputs
                if (item.querySelector("sl-input")) return;

                // Save original text node
                let textNode = Array.from(item.childNodes).find(n => n.nodeType === Node.TEXT_NODE) as Text;

                // If no text node exists, create one
                if (!textNode) {
                    textNode = document.createTextNode("");
                    item.prepend(textNode);
                }

                const oldLabel = textNode.textContent || "";

                // Create Shoelace input
                const input = document.createElement("sl-input") as any;
                input.type = "text";
                input.value = oldLabel;
                input.style.width = "100%";

                // Hide the text node visually
                textNode.textContent = "";

                item.appendChild(input);
                await customElements.whenDefined("sl-input");

                input.focus();
                input.select();

                // Exit edit mode
                const exitEdit = (saveValue: boolean) => {
                    textNode.textContent = saveValue ? input.value || oldLabel : oldLabel;
                    input.remove();
                };

                input.addEventListener("sl-blur", () => exitEdit(true));
                input.addEventListener("keydown", (e: KeyboardEvent) => {
                    if (e.key === "Enter") exitEdit(true);
                    if (e.key === "Escape") exitEdit(false);
                });
            });
        });


    }

    public addItem(text: string, id: string, parent: SlTree | SlTreeItem): SlTreeItem {
        const item = Object.assign(document.createElement("sl-tree-item") as SlTreeItem, {
            textContent: text,
            hierarchyId: id
        });

        parent.appendChild(item);
        return item;
    }
}