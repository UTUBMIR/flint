import GameObject from "../../runtime/game-object";
import Layer from "../../runtime/layer";
import { System } from "../../runtime/system";
import Metadata from "../../shared/metadata";
import Editor, { Notifier } from "../editor";
import { type DropdownType } from "../editor";


export default class Hierarchy {
    public element: HTMLElement;
    public layers = new Map<number, Layer>();

    private selection: GameObject | Layer | undefined;
    public contextDropdownElement: DropdownType;
    public contextMenuElement: HTMLElement;
    private cachedWidth = 0;
    private cachedHeight = 0;

    public constructor(element: HTMLElement) {
        this.element = element;

        this.element.addEventListener("sl-selection-change", this.onSelectionChange.bind(this));

        this.contextDropdownElement = this.element.parentElement!.querySelector("#hierarchy-context-dropdown") as DropdownType;
        this.contextMenuElement = this.contextDropdownElement.querySelector("#hierarchy-context-menu") as HTMLElement;
        this.setupContextMenu();
    }

    private setupContextMenu() {
        this.contextDropdownElement.addEventListener("sl-after-show", () => {
            if (this.cachedWidth === 0) {
                this.cachedWidth = this.contextMenuElement.clientWidth;
                this.cachedHeight = this.contextMenuElement.clientHeight;
            }
        });

        this.element.parentElement!.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            this.contextDropdownElement.show();

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
            System.pushLayer(layer);
            this.onUpdate();
        });

        this.contextMenuElement.querySelector("#new-gameobject-button")!.addEventListener("click", () => {
            this.createObject();
        });
    }

    private positionDropdown(e: MouseEvent) {
        const x = Math.min(document.body.clientWidth - this.cachedWidth, e.pageX);
        const y = Math.min(document.body.clientHeight - this.cachedHeight, e.pageY);

        Object.assign(this.contextDropdownElement.style, { left: `${x}px`, top: `${y}px` });
        this.contextDropdownElement.reposition();
    }

    private onSelectionChange(event: Event) {
        const selection = (event as CustomEvent).detail.selection as HTMLElement[];
        const parsed = (selection[0]! as unknown as { hierarchyId: string }).hierarchyId

            .split("-")
            .map(i => Number.parseInt(i));

        const layer = this.layers.get(parsed[0] ?? 0);

        if (parsed[1]) {
            this.selection = layer?.getObjects()[parsed[1]];
        }
        else {
            this.selection = layer;
        }

        if (!this.selection) {
            throw new Error("Failed to get 'selection'");
        }
    }

    public createObject() {
        if (this.selection) {
            if (this.selection instanceof Layer) {
                this.selection.addObject(new GameObject());
            }
            else {
                this.selection.layer.addObject(new GameObject());
            }
        }
        else {
            if (System.layers.length === 0) {
                Notifier.notify("GameObject can be created only inside a Layer.", "danger");
                return;
            }

            const layer = System.layers[0]!;
            layer.addObject(new GameObject());
        }
        this.onUpdate();
    }

    public async onUpdate() {//TODO: add partial update without need to recreate whole hierarchy
        this.layers.clear();
        this.element.innerHTML = "";

        for (let layerIndex = System.layers.length - 1; layerIndex >= 0; layerIndex--) {
            const layer = System.layers[layerIndex]!;
            const layerName = `new Layer${layerIndex > 0 ? " " + layerIndex : ""}`;

            const layerItem = this.addItem(layerName, layerIndex.toString(), this.element);

            const objects = layer.getObjects();
            for (let index = objects.length - 1; index >= 0; index--) {
                const objectName = Metadata.getClass(
                    objects[index]!, "inspector-name") ??
                    `new GameObject${index > 0 ? " " + index : ""}`;

                this.addItem(
                    objectName,
                    `${layerIndex}-${index}`,
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

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    let parsed = (item as any).hierarchyId;
                    if (parsed) {
                        parsed = parsed.split("-")
                            .map((i: string) => Number.parseInt(i));

                        const layer = Editor.hierarchyWindow.layers.get(parsed[0] ?? 0);
                        const gameObject = layer?.getObjects()[parsed[1] ?? 0];

                        Metadata.setClass(gameObject!, "inspector-name", textNode.textContent);
                    }
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
            hierarchyId: id,
            expanded: true
        });

        parent.appendChild(item);
        return item;
    }
}