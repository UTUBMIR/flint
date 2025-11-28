import type Layer from "../../runtime/layer";
import { System } from "../../runtime/system";

export default class Hierarchy {
    public element: HTMLElement;
    public layers = new Map<number, Layer>();

    public constructor(element: HTMLElement) {
        this.element = element;
    }

    public onUpdate() {
        this.layers.clear();
        for (let layerIndex = System.layers.length - 1; layerIndex >= 0; layerIndex--) {
            const layer = System.layers[layerIndex]!;
            const layerName = `new Layer${layerIndex > 0 ? " " + layerIndex : ""}`;

            const layerItem = this.addItem(layerName, layerIndex.toString(), this.element);

            const objects = layer.getObjects();
            for (let index = objects.length - 1; index >= 0; index--) {
                const objectName = `new GameObject${index > 0 ? " " + index : ""}`;
                this.addItem(
                    objectName,
                    `${layerIndex}-${index}`,
                    layerItem
                );
            }

            this.layers.set(layerIndex, layer);
        }


        const treeItems = document.querySelectorAll("sl-tree-item");

        treeItems.forEach(item => {//BUG: This will change ALL inputs at the page
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
                const input = document.createElement("sl-input") as HTMLInputElement;
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

    public addItem(text: string, id: string, parent: HTMLElement): HTMLElement {
        const item = Object.assign(document.createElement("sl-tree-item") as HTMLElement, {
            textContent: text,
            hierarchyId: id
        });

        parent.appendChild(item);
        return item;
    }
}