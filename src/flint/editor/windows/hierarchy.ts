import GameObject from "../../runtime/game-object";
import Layer from "../../runtime/layer";
import { System, type UUID } from "../../runtime/system";
import Metadata, { MetadataKeys } from "../../shared/metadata";
import Editor from "../editor";
import { type DropdownType } from "../editor";
import { EditorLayer } from "../editor-layer";

import type SlInput from "@shoelace-style/shoelace/dist/components/input/input.js";

/**
 * Sets a name for and object, exists only in the Editor.
 * @param name - Name to show in the Editor.
 */
export function EditorName(name: string) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (target: any) => {
        if (typeof target === "function") {
            Metadata.setClass(target.prototype, MetadataKeys.EditorName, name);
        } else {
            Metadata.setClass(target, MetadataKeys.EditorName, name);
        }
    };
}


export default class Hierarchy {
    public element: HTMLElement;
    public layers = new Map<number, Layer>();

    private selection: GameObject | Layer | undefined;
    private selectedElement: HTMLElement | undefined;

    public contextDropdownElement: DropdownType;
    public contextMenuElement: HTMLElement;
    private cachedWidth = 0;
    private cachedHeight = 0;

    private deleteButton: HTMLButtonElement;

    public constructor(element: HTMLElement) {
        this.element = element;

        this.element.addEventListener("sl-selection-change", this.onSelectionChange.bind(this));

        this.contextDropdownElement = this.element.parentElement!.querySelector("#hierarchy-context-dropdown") as DropdownType;
        this.contextMenuElement = this.contextDropdownElement.querySelector("#hierarchy-context-menu") as HTMLElement;

        this.deleteButton = this.contextMenuElement.querySelector("#delete-button") as HTMLButtonElement;

        this.element.parentElement!.addEventListener("click", () => {
            this.element.dispatchEvent(new Event("sl-selection-change"));
        }, true);

        this.setupContextMenu();
    }

    private setupContextMenu(): void {
        this.contextDropdownElement.addEventListener("sl-after-show", () => {
            if (this.cachedWidth === 0) {
                this.cachedWidth = this.contextMenuElement.clientWidth;
                this.cachedHeight = this.contextMenuElement.clientHeight;
            }
        });

        this.element.parentElement!.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            this.contextDropdownElement.show();

            if (e.target === this.element.parentElement || e.target === this.element || e.target !== this.selectedElement) {
                this.deleteButton.style.display = "none";
            }
            else {
                this.deleteButton.style.display = "block";
            }

            if (this.cachedWidth === 0) {
                this.positionDropdown(e);
                this.contextDropdownElement.addEventListener(
                    "sl-after-show",
                    () => this.positionDropdown(e),
                    { once: true }
                );
            } else {
                this.positionDropdown(e);
            }
        });

        this.contextMenuElement.querySelector("#new-layer-button")!.addEventListener("click", () => {
            const layer = new Layer();
            System.world.addLayer(layer);
            this.update();
        });

        this.contextMenuElement.querySelector("#new-gameobject-button")!.addEventListener("click", () => {
            this.createObject();
        });

        this.contextMenuElement.querySelector("#delete-button")!.addEventListener("click", () => {
            this.deleteSelected();
        });
    }

    private positionDropdown(e: MouseEvent): void {
        const x = Math.min(document.body.clientWidth - this.cachedWidth, e.pageX);
        const y = Math.min(document.body.clientHeight - this.cachedHeight, e.pageY);

        Object.assign(this.contextDropdownElement.style, { left: `${x}px`, top: `${y}px` });
        this.contextDropdownElement.reposition();
    }

    private onSelectionChange(event: Event): void {
        if (!(event as CustomEvent).detail) {
            this.selectedElement?.removeAttribute("selected");
            return;
        }

        const selection = (event as CustomEvent).detail.selection as HTMLElement[];
        this.selectedElement = selection[0];
        const id = selection[0]!.dataset.id! as UUID;

        this.selection = System.world.getById(id);

        if (!this.selection) {
            throw new Error("Failed to get 'selection'");
        }
        event.stopPropagation();
    }

    public createObject(): void {
        if (this.selection) {
            if (this.selection instanceof Layer) {
                this.selection.addObject(new GameObject());
            }
            else {
                this.selection.layer.addObject(new GameObject());
            }
        }
        else {
            if (System.world.getLayers().length === 0) {
                const layer = new Layer();
                System.world.addLayer(layer);
                this.update();
                return;
            }

            const layer = System.world.getLayers()[0]!;
            layer.addObject(new GameObject());
        }
        this.update();
    }

    public deleteSelected(): void {
        if (this.selection) {
            if (this.selection instanceof GameObject) {
                this.selection.layer.removeObject(this.selection);
            }
            else {
                System.world.removeLayer(this.selection);
            }
            Editor.hierarchyWindow.update();
        }
    }

    public async update() {//TODO: add partial update without need to recreate whole hierarchy
        this.layers.clear();
        this.element.innerHTML = "";

        for (let layerIndex = System.world.getLayers().length - 1; layerIndex >= 0; --layerIndex) {
            const layer = System.world.getLayers()[layerIndex]!;
            if (layer instanceof EditorLayer) {
                continue;
            }

            const layerName = Metadata.getClass(
                layer, MetadataKeys.EditorName, false) ??
                `new Layer${layerIndex > 0 ? " " + layerIndex : ""}`;

            const layerItem = this.addItem(layerName, layer.id, this.element);

            const objects = layer.getObjects();
            for (let index = objects.length - 1; index >= 0; index--) {
                const objectName = Metadata.getClass(
                    objects[index]!, MetadataKeys.EditorName, false) ??
                    `new GameObject${index > 0 ? " " + index : ""}`;

                this.addItem(
                    objectName,
                    objects[index]!.id,
                    layerItem
                );
            }

            this.layers.set(layerIndex, layer);
        }

        const treeItems = document.querySelectorAll("sl-tree-item");

        treeItems.forEach(item => {//BUG: This will change ALL inputs at the page (probably)
            item.addEventListener("dblclick", async () => {
                // Prevent multiple inputs
                if (item.querySelector("sl-input")) return;

                // Save original text node
                let textNode = Array.from(item.childNodes).find(n => n.nodeType === Node.TEXT_NODE) as Text;

                if (!textNode) {
                    textNode = document.createTextNode("");
                    item.prepend(textNode);
                }

                const oldLabel = textNode.textContent || "";

                const input = document.createElement("sl-input") as SlInput;
                input.type = "text";
                input.value = oldLabel;
                input.name = "gameObjectName";
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

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    const id = (item as any).dataset.id;
                    const found = System.world.getById(id);

                    if (found) {
                        Metadata.setClass(found, MetadataKeys.EditorName, textNode.textContent);
                    }

                    try {
                        input.remove();
                    }
                    // eslint-disable-next-line no-empty
                    catch { }
                };

                input.addEventListener("sl-blur", () => exitEdit(true));
                input.addEventListener("keydown", (e: KeyboardEvent) => {
                    if (e.key === "Enter") exitEdit(true);
                    if (e.key === "Escape") exitEdit(false);
                });
            });
        });


    }

    public addItem(text: string, id: UUID, parent: HTMLElement): HTMLElement {
        const item = document.createElement("sl-tree-item") as HTMLElement;
        item.textContent = text;
        item.setAttribute("expanded", "true");
        item.dataset.id = id;

        item.draggable = true;

        function dragstartHandler(ev: DragEvent) {
            const go = System.world.getGameObjectById(id);

            if (!go) {
                return;
            }

            ev.dataTransfer!.setData("application/x-gameobject-id", go.id);
        }

        item.addEventListener("dragstart", dragstartHandler);

        parent.appendChild(item);
        return item;
    }
}