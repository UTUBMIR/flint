/* eslint-disable @typescript-eslint/no-explicit-any */
import Vector2D from "../../shared/vector2d.js";
import type GameObject from "../../runtime/game-object.js";
import Editor, { Notifier } from "../editor.js";
import Component from "../../runtime/component.js";
import { ComponentBuilder } from "../component-builder.js";
import { System } from "../../runtime/system.js";

class InspectorComponent {
    public readonly element: HTMLElement;
    public readonly component: Component;

    public constructor(component: Component) {
        this.component = component;

        this.element = Object.assign(document.createElement("sl-details") as HTMLElement, {
            summary: component.constructor.name,
            open: true
        });

        this.generateContent();
    }

    public generateContent() {
        this.element.appendChild(ComponentBuilder.build(this.component));
    }
}


export default class Inspector {
    protected minSize: Vector2D = new Vector2D(250, 100);
    // private tree: Tree = new Tree(this.rect);
    private currentObject: GameObject | undefined;
    private components: InspectorComponent[] = [];

    private element: HTMLDivElement;
    private dialog: any;
    private dialogSelect: HTMLSelectElement;
    private addComponentButton: HTMLButtonElement;
    private dialogAddButton: HTMLButtonElement;

    public constructor(element: HTMLDivElement, dialog: HTMLElement) {
        this.element = element;
        this.dialog = dialog;

        this.dialogSelect = this.dialog.getElementsByTagName("sl-select")[0] as HTMLSelectElement;
        this.dialogAddButton = this.dialog.getElementsByTagName("sl-button")[0] as HTMLButtonElement;

        Editor.hierarchy.element.addEventListener("sl-selection-change", this.onEvent.bind(this));


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

            this.dialogSelect.appendChild(Object.assign(document.createElement("sl-option"), {
                value: component.name,
                textContent: ComponentBuilder.splitPascalCase(component.name)
            }));
        }

        (this.dialogSelect as any).value = "";


        this.dialog.show();
    }

    private addInspectorComponent(component: Component) {
        const ic = new InspectorComponent(component);

        this.element.appendChild(ic.element);
        this.components.push(ic);
    }

    public onEvent(event: Event) {
        const selection = (event as CustomEvent).detail.selection as HTMLElement[];
        const parsed = (selection[0]! as unknown as { hierarchyId: string }).hierarchyId

            .split("-")
            .map(i => Number.parseInt(i));
            
        if (parsed.length !== 2) return;

        const layer = Editor.hierarchy.layers.get(parsed[0] ?? 0);

        this.currentObject = layer?.getObjects()[parsed[1] ?? 0];

        if (!this.currentObject) {
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

        for (let i = 0; i < expected.length; i++) {
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