import GameObject from "@flint/runtime/game-object";
import Layer from "@flint/runtime/layer";
import { System, type UUID } from "@flint/runtime/system";
import Metadata, { MetadataKeys } from "@flint/shared/metadata";
import { EditorLayer } from "../editor-layer";
import type SlInput from "@shoelace-style/shoelace/dist/components/input/input.js";
import { BaseEditorWindow, type WindowContext } from "../ui/window-framework";

/**
 * Sets a name for and object, exists only in the Editor.
 * @param name - Name to show in the Editor.
 */
export function EditorName(name: string) {
    return function (
        target: (abstract new (...args: any[]) => object) | object,
        context?: ClassDecoratorContext
    ) {
        if (context && context.kind !== "class") {
            throw new Error("@EditorName can only decorate classes.");
        }

        if (typeof target === "function") {
            Metadata.setClass(target.prototype, MetadataKeys.EditorName, name);
        } else {
            Metadata.setClass(target, MetadataKeys.EditorName, name);
        }
    };
}

export default class HierarchyWindow extends BaseEditorWindow {
    public readonly element: HTMLElement;
    private selection: GameObject | Layer | undefined;
    private selectedElement: HTMLElement | undefined;
    private readonly contextDropdownElement: HTMLElement & { show: () => void; reposition: () => void };
    private readonly contextMenuElement: HTMLElement;
    private readonly deleteButton: HTMLButtonElement;
    private cachedWidth = 0;
    private cachedHeight = 0;
    private lastContentKey = "";

    private computeContentKey(): string {
        if (!System.world) {
            return "";
        }

        const parts: string[] = [];
        for (const layer of System.world.getLayers()) {
            if (layer instanceof EditorLayer) {
                continue;
            }
            parts.push(`L:${layer.id}:${Metadata.getClass(layer, MetadataKeys.EditorName, false) ?? ""}`);
            for (const obj of layer.getObjects()) {
                parts.push(`O:${obj.id}:${Metadata.getClass(obj, MetadataKeys.EditorName, false) ?? ""}`);
            }
        }
        return parts.join("|");
    }

    public constructor(context: WindowContext) {
        super(context);

        this.root.className = "panel-content";
        this.root.innerHTML = `
            <div class="panel-body hierarchy-panel-body">
                <sl-dropdown data-role="context-dropdown" style="position: absolute;">
                    <sl-menu data-role="context-menu">
                        <sl-menu-label>Create</sl-menu-label>
                        <sl-menu-item data-role="new-layer" value="new-layer">
                            <sl-icon slot="prefix" name="layers"></sl-icon>
                            New Layer
                        </sl-menu-item>
                        <sl-menu-item data-role="new-gameobject" value="new-gameobject">
                            <sl-icon slot="prefix" name="box"></sl-icon>
                            New GameObject
                        </sl-menu-item>
                        <sl-menu-item class="danger-background danger-label danger-prefix" data-role="delete-button" value="delete">
                            <sl-icon slot="prefix" name="trash"></sl-icon>
                            Delete
                        </sl-menu-item>
                    </sl-menu>
                </sl-dropdown>
                <sl-tooltip content="Create object">
                    <sl-icon-button data-role="create-object-button" class="floating-panel-action"
                        name="plus-square"></sl-icon-button>
                </sl-tooltip>
                <sl-tree data-role="hierarchy-tree" style="--indent-guide-width: 1px;"></sl-tree>
            </div>
        `;

        this.element = this.query('[data-role="hierarchy-tree"]');
        this.contextDropdownElement = this.query('[data-role="context-dropdown"]') as HTMLElement & { show: () => void; reposition: () => void };
        this.contextMenuElement = this.query('[data-role="context-menu"]');
        this.deleteButton = this.query('[data-role="delete-button"]');
    }

    public override initialize(): void {
        this.listen(this.element, "sl-selection-change" as keyof HTMLElementEventMap, event => {
            this.onSelectionChange(event as Event);
        });

        this.listen(this.query('[data-role="create-object-button"]'), "click", () => {
            this.createObject();
        });

        this.listen(this.contextDropdownElement, "sl-after-show" as keyof HTMLElementEventMap, () => {
            if (this.cachedWidth === 0) {
                this.cachedWidth = this.contextMenuElement.clientWidth;
                this.cachedHeight = this.contextMenuElement.clientHeight;
            }
        });

        this.listen(this.root, "contextmenu", event => {
            event.preventDefault();
            this.contextDropdownElement.show();

            if (event.target === this.root || event.target === this.element || event.target !== this.selectedElement) {
                this.deleteButton.style.display = "none";
            } else {
                this.deleteButton.style.display = "block";
            }

            if (this.cachedWidth === 0) {
                this.positionDropdown(event);
                this.contextDropdownElement.addEventListener("sl-after-show", () => this.positionDropdown(event), { once: true });
            } else {
                this.positionDropdown(event);
            }
        });

        this.listen(this.query('[data-role="new-layer"]'), "click", () => {
            const layer = new Layer();
            System.world.addLayer(layer);
            this.context.manager.refreshWindows("Hierarchy");
        });

        this.listen(this.query('[data-role="new-gameobject"]'), "click", () => {
            this.createObject();
        });

        this.listen(this.deleteButton, "click", () => {
            this.deleteSelected();
        });

        this.registerCleanup(this.context.services.selection.subscribe(selectedId => {
            this.syncSelectionFromService(selectedId);
        }));

        this.update();
    }

    private positionDropdown(event: MouseEvent): void {
        const container = this.contextDropdownElement.offsetParent instanceof HTMLElement
            ? this.contextDropdownElement.offsetParent
            : this.root;
        const rect = container.getBoundingClientRect();
        const scrollLeft = container.scrollLeft;
        const scrollTop = container.scrollTop;
        const maxX = Math.max(scrollLeft, scrollLeft + container.clientWidth - this.cachedWidth);
        const maxY = Math.max(scrollTop, scrollTop + container.clientHeight - this.cachedHeight);
        const x = Math.min(maxX, Math.max(scrollLeft, event.clientX - rect.left + scrollLeft));
        const y = Math.min(maxY, Math.max(scrollTop, event.clientY - rect.top + scrollTop));

        Object.assign(this.contextDropdownElement.style, { left: `${x}px`, top: `${y}px` });
        this.contextDropdownElement.reposition();
    }

    private onSelectionChange(event: Event): void {
        const customEvent = event as CustomEvent;
        if (!customEvent.detail) {
            this.selectedElement?.removeAttribute("selected");
            this.selection = undefined;
            this.context.services.selection.setSelectedId(null);
            return;
        }

        const selection = customEvent.detail.selection as HTMLElement[];
        this.selectedElement = selection[0];
        const id = selection[0]!.dataset.id! as UUID;
        this.selection = System.world ? System.world.getById(id) : undefined;
        this.context.services.selection.setSelectedId(id);
        event.stopPropagation();
    }

    private syncSelectionFromService(selectedId: UUID | null): void {
        const treeItems = this.element.querySelectorAll<HTMLElement>("sl-tree-item");
        for (const item of treeItems) {
            if (item.dataset.id === selectedId) {
                item.setAttribute("selected", "");
                this.selectedElement = item;
            } else {
                item.removeAttribute("selected");
            }
        }
    }

    public createObject(): void {
        if (this.selection instanceof Layer) {
            this.selection.addObject(new GameObject());
        } else if (this.selection instanceof GameObject) {
            this.selection.layer.addObject(new GameObject());
        } else if (!System.world || System.world.getLayers().length === 0) {
            const layer = new Layer();
            System.world.addLayer(layer);
        } else {
            System.world.getLayers()[0]!.addObject(new GameObject());
        }

        this.context.manager.refreshWindows("Hierarchy");
    }

    public deleteSelected(): void {
        if (!this.selection) {
            return;
        }

        if (this.selection instanceof GameObject) {
            this.selection.layer.removeObject(this.selection);
        } else {
            System.world.removeLayer(this.selection);
        }

        this.context.services.selection.setSelectedId(null);
        this.context.manager.refreshWindows("Hierarchy");
    }

    public update(): void {
        const contentKey = this.computeContentKey();
        if (contentKey === this.lastContentKey) {
            return;
        }
        this.lastContentKey = contentKey;

        this.element.innerHTML = "";

        if (!System.world) {
            return;
        }

        for (let layerIndex = System.world.getLayers().length - 1; layerIndex >= 0; --layerIndex) {
            const layer = System.world.getLayers()[layerIndex]!;
            if (layer instanceof EditorLayer) {
                continue;
            }

            const layerName = Metadata.getClass(layer, MetadataKeys.EditorName, false)
                ?? `new Layer${layerIndex > 0 ? " " + layerIndex : ""}`;

            const layerItem = this.addItem(layerName, layer.id, this.element);
            const objects = layer.getObjects();

            for (let index = objects.length - 1; index >= 0; index--) {
                const objectName = Metadata.getClass(objects[index]!, MetadataKeys.EditorName, false)
                    ?? `new GameObject${index > 0 ? " " + index : ""}`;

                this.addItem(objectName, objects[index]!.id, layerItem);
            }
        }

        this.installRenameHandlers();
        this.syncSelectionFromService(this.context.services.selection.getSelectedId());
    }

    private installRenameHandlers(): void {
        const treeItems = this.element.querySelectorAll<HTMLElement>("sl-tree-item");
        for (const item of treeItems) {
            item.addEventListener("dblclick", async () => {
                if (item.querySelector("sl-input")) {
                    return;
                }

                let textNode = Array.from(item.childNodes).find(node => node.nodeType === Node.TEXT_NODE) as Text;
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
                textNode.textContent = "";
                item.appendChild(input);
                await customElements.whenDefined("sl-input");
                input.focus();
                input.select();

                const exitEdit = (saveValue: boolean) => {
                    textNode.textContent = saveValue ? input.value || oldLabel : oldLabel;
                    const found = System.world.getById(item.dataset.id as UUID);
                    if (found) {
                        Metadata.setClass(found, MetadataKeys.EditorName, textNode.textContent);
                    }
                    input.remove();
                };

                input.addEventListener("sl-blur", () => exitEdit(true));
                input.addEventListener("keydown", (event: KeyboardEvent) => {
                    if (event.key === "Enter") exitEdit(true);
                    if (event.key === "Escape") exitEdit(false);
                });
            });
        }
    }

    public addItem(text: string, id: UUID, parent: HTMLElement): HTMLElement {
        const item = document.createElement("sl-tree-item");
        item.textContent = text;
        item.setAttribute("expanded", "true");
        item.dataset.id = id;
        item.draggable = true;
        item.addEventListener("dragstart", event => {
            const gameObject = System.world.getGameObjectById(id);
            if (!gameObject) {
                return;
            }

            event.dataTransfer?.setData("application/x-gameobject-id", gameObject.id);
        });

        parent.appendChild(item);
        return item;
    }
}
