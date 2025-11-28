/* eslint-disable @typescript-eslint/no-explicit-any */
import Vector2D from "../../shared/vector2d.js";
import type GameObject from "../../runtime/game-object.js";
import Editor from "../editor.js";
import Component from "../../runtime/component.js";
import { ComponentBuilder } from "../component-builder.js";

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

    public constructor(element: HTMLDivElement) {
        this.element = element;

        Editor.hierarchy.element.addEventListener("sl-selection-change", this.onEvent.bind(this));
    }

    public addComponent(component: Component) {
        const ic = new InspectorComponent(component);

        this.element.appendChild(ic.element);
        this.components.push(ic);
    }

    public onEvent(event: Event) {
        const selection = (event as CustomEvent).detail.selection as HTMLElement[];
        const parsed = (selection[0]! as unknown as { hierarchyId: string }).hierarchyId

            .split("-")
            .map(i => Number.parseInt(i));

        const layer = Editor.hierarchy.layers.get(parsed[0] ?? 0);
        this.currentObject = layer?.getObjects()[parsed[1] ?? 0];

        if (!this.currentObject) {
            throw new Error("Failed to get 'currentObject'");
        }

        this.element.innerHTML = "";

        ComponentBuilder.clearFields();
        this.components = [];

        this.addComponent(this.currentObject.transform as Component);


        for (const component of this.currentObject.getAllComponents()) {
            this.addComponent(component);
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

            this.addComponent(this.currentObject.transform as Component);

            for (const component of this.currentObject.getAllComponents()) {
                this.addComponent(component);
            }
        }

        ComponentBuilder.updateFields();
    }
}