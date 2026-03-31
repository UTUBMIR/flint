/* eslint-disable @typescript-eslint/no-explicit-any */
import Vector2 from "../../shared/vector2";
import type GameObject from "../../runtime/game-object";
import Editor, { Notifier } from "../editor";
import type Component from "../../runtime/component";
import { ComponentBuilder } from "../component-builder";
import { System, type UUID } from "../../runtime/system";
import { CasingHandler } from "../casing-handler";
class InspectorComponent {
    public readonly element: HTMLElement;
    private allowDrag = false;

    public constructor(public component: Component) {
        this.element = Object.assign(
            document.createElement("sl-details"),
            {
                summary: component.constructor.name,
                open: true,
                draggable: true
            }
        );

        this.element.addEventListener("mousedown", (ev) => {
            const path = ev.composedPath();

            // allowing ONLY if click was on "summary"
            this.allowDrag = path.some(
                el =>
                    el instanceof HTMLElement &&
                    el.getAttribute?.("part") === "summary"
            );
        }, true);

        this.element.addEventListener("dragstart", (ev) => {
            if (!this.allowDrag) {
                ev.preventDefault();
                return;
            }

            ev.dataTransfer!.setData(
                "application/x-component-ref",
                JSON.stringify({
                    name: component.constructor.name,
                    id: component.gameObject.id
                })
            );
        });

        this.element.addEventListener("dragend", () => {
            this.allowDrag = false;
        });

        this.generateContent();
    }

    public generateContent() {
        this.element.appendChild(ComponentBuilder.build(this.component));
    }
}


export default class Inspector {
    protected minSize: Vector2 = new Vector2(250, 100);
    // private tree: Tree = new Tree(this.rect);
    public currentObject: GameObject | undefined;
    private components: InspectorComponent[] = [];

    private dropTarget: HTMLDivElement | null = null;
    private element: HTMLDivElement;
    private dialog: any;
    private dialogSelect: HTMLSelectElement;
    private addComponentButton: HTMLButtonElement;
    private dialogAddButton: HTMLButtonElement;

    public constructor(element: HTMLDivElement, dialog: HTMLElement) {
        this.element = element;
        this.dialog = dialog;

        this.dropTarget = document.getElementById("inspector-drop-target") as HTMLDivElement;
        this.dropTarget.addEventListener("dragover", (ev) => {
            ev.preventDefault();
        });

        this.dropTarget.addEventListener("drop", (ev) => {
            const componentName = ev.dataTransfer!.getData("application/x-component-name");

            if (componentName.length > 0) {
                ev.preventDefault();
                this.currentObject?.addComponent(new (System.components.get(componentName) as any)());
            }
        });

        this.dialogSelect = this.dialog.getElementsByTagName("sl-select")[0] as HTMLSelectElement;
        this.dialogAddButton = this.dialog.getElementsByTagName("sl-button")[0] as HTMLButtonElement;

        Editor.hierarchyWindow.element.addEventListener("sl-selection-change", this.onEvent.bind(this));


        this.addComponentButton = document.getElementById("add-component-button")! as HTMLButtonElement;
        this.addComponentButton.addEventListener("click", this.addComponent.bind(this));



        this.dialogSelect.addEventListener("sl-change", () => {
            this.dialogAddButton.disabled = false;
        });

        this.dialogAddButton.addEventListener("click", () => {
            this.dialog.hide();
            if (this.currentObject) {
                const component = System.components.get(this.dialogSelect.value);
                if (!component) return;

                this.currentObject.addComponent(new (component as any)());
            }
        });
    }

    public async addComponent() {
        if (!this.currentObject) {
            Notifier.notify("Select object first.", "primary");
            return;
        }

        this.dialogAddButton.disabled = true;

        this.dialogSelect.innerHTML = "";

        for (const [_key, component] of System.components) {
            if (component.name === undefined) continue;

            this.dialogSelect.append(Object.assign(document.createElement("sl-option"), {
                value: component.name,
                textContent: CasingHandler.splitPascalCase(component.name)
            }));
        }

        this.dialogSelect.setAttribute("value", "");


        this.dialog.show();
    }

    private addInspectorComponent(component: Component) {
        const ic = new InspectorComponent(component);

        this.element.appendChild(ic.element);
        this.components.push(ic);
    }

    public onEvent(event: Event) {
        if (!(event as CustomEvent).detail) {
            this.currentObject = undefined;
            this.element.innerHTML = "";
            this.addComponentButton.style.display = "none";
            return;
        }

        const selection = (event as CustomEvent).detail.selection as HTMLElement[];
        const id = selection[0]!.dataset.id as UUID;

        this.currentObject = System.world.getGameObjectById(id);
        const layer = System.world.getLayerById(id);

        if (!this.currentObject) {
            if (layer) {
                return;
            }
            throw new Error("Failed to get 'currentObject'");
        }

        this.element.innerHTML = "";
        this.addComponentButton.style.display = "initial";

        ComponentBuilder.clearFields();
        this.components = [];

        this.addInspectorComponent(this.currentObject.transform as Component);


        for (const component of this.currentObject.getAllComponents()) {
            this.addInspectorComponent(component);
        }
    }

    private componentsMatch(): boolean {
        if (!this.currentObject) return false;

        const expected: Component[] = [
            this.currentObject.transform,
            ...this.currentObject.getAllComponents()
        ];

        if (expected.length !== this.components.length) return false;

        for (let i = 0; i < expected.length; ++i) {
            if (this.components[i]!.component !== expected[i]) {
                return false;
            }
        }

        return true;
    }

    public update() {
        if (!this.currentObject) return;

        if (!this.componentsMatch()) {
            this.element.innerHTML = "";

            ComponentBuilder.clearFields();
            this.components = [];

            this.addInspectorComponent(this.currentObject.transform as Component);

            for (const component of this.currentObject.getAllComponents()) {
                this.addInspectorComponent(component);
            }
        }

        ComponentBuilder.updateFields();
    }
}