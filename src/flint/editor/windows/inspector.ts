/* eslint-disable @typescript-eslint/no-explicit-any */
import Vector2D from "../../shared/vector2d.js";
import type GameObject from "../../runtime/game-object.js";
import Editor from "../editor.js";
import SlTreeItem from "@shoelace-style/shoelace/dist/components/tree-item/tree-item.component.js";
import SlDetails from "@shoelace-style/shoelace/dist/components/details/details.component.js";
import Component from "../../runtime/component.js";
import { isColor } from "../../shared/graphics.js";

type FieldRenderer = (root: Component, path: string[]) => HTMLElement;

class ComponentBuilder {
    private static fields: { update: () => void }[] = [];

    private constructor() { }

    private static fieldRenderers: Record<string, FieldRenderer> = {
        number: (root, path) => {
            const value = this.get(root, path);
            const input = document.createElement("sl-input") as any;
            input.type = "number";
            input.value = (value ?? 0).toString();
            input.step = 10;

            input.addEventListener("sl-input", (e: any) => {
                const v = parseFloat(e.target.value);
                if (!Number.isNaN(v)) this.set(root, path, v);
            });

            function roundUpTo(number: number, decimalPlaces: number) {
                const factor = Math.pow(10, decimalPlaces);
                return Math.round(number * factor) / factor;
            }

            this.fields.push({
                update: () => {
                    const value = roundUpTo(this.get(root, path), 6).toString();
                    if (input.value !== value) {
                        input.value = value;
                    }
                }
            });

            //SCRUBBABLE DRAG LOGIC WITH POINTER LOCK
            let dragging = false;
            let startValue = 0;
            let usingPointerLock = false;
            let skipFirstLockedMove = false;

            const dragSpeed = 0.5;
            const shiftMultiplier = 8;
            const ctrlMultiplier = 0.1;

            const EDGE_THRESHOLD = 4; // px from screen edge before locking pointer
            const DRAG_THRESHOLD = 3; // px movement before starting scrub

            let startX = 0;
            let moved = false;

            const shouldLockPointer = (x: number) => x <= EDGE_THRESHOLD || x >= window.innerWidth - EDGE_THRESHOLD;

            const handleMouseMove = (ev: MouseEvent) => {
                if (!dragging) return;

                // Track total movement to decide when scrubbing starts
                if (!moved) {
                    const dx = ev.clientX - startX;
                    if (Math.abs(dx) < DRAG_THRESHOLD) return;
                    moved = true;
                }

                // Enter pointer lock only if near edges
                if (!usingPointerLock && shouldLockPointer(ev.clientX)) {
                    usingPointerLock = true;
                    skipFirstLockedMove = true;
                    input.requestPointerLock();
                    return;
                }

                // Skip first pointer-lock event to prevent jump
                if (usingPointerLock && skipFirstLockedMove) {
                    skipFirstLockedMove = false;
                    return;
                }

                let delta = ev.movementX;
                delta *= dragSpeed;
                if (ev.shiftKey) delta *= shiftMultiplier;
                if (ev.ctrlKey) delta *= ctrlMultiplier;

                const newValue = startValue + delta;
                startValue = newValue;

                input.value = newValue.toString();
                this.set(root, path, newValue);
                ComponentBuilder.updateFields();
            };

            const stopDragging = () => {
                dragging = false;
                moved = false;

                if (usingPointerLock) {
                    usingPointerLock = false;
                    document.exitPointerLock();
                }

                window.removeEventListener("mousemove", handleMouseMove);
                window.removeEventListener("mouseup", stopDragging);
            };

            input.addEventListener("mousedown", (ev: MouseEvent) => {
                if (ev.button !== 0) return;

                startX = ev.clientX;
                startValue = parseFloat(input.value) || 0;
                moved = false;
                dragging = true;
                usingPointerLock = false;
                skipFirstLockedMove = false;

                window.addEventListener("mousemove", handleMouseMove);
                window.addEventListener("mouseup", stopDragging);
            });

            // Mouse wheel handler
            const handleWheel = (ev: WheelEvent) => {
                ev.preventDefault(); // prevent page scroll

                let delta = ev.deltaY * -0.1; // negative so wheel up = increase
                delta *= dragSpeed;

                if (ev.shiftKey) delta *= shiftMultiplier;
                if (ev.ctrlKey) delta *= ctrlMultiplier;

                const newValue = (parseFloat(input.value) || 0) + delta;

                startValue = newValue; // keep dragging consistent
                input.value = newValue.toString();
                this.set(root, path, newValue);
                ComponentBuilder.updateFields();
            };

            input.addEventListener("wheel", handleWheel, { passive: false });

            return this.wrapField(this.lastKey(path), input as HTMLElement);
        },
        string: (root, path) => {
            const value = this.get(root, path);
            const input = document.createElement("sl-input") as any;
            input.value = value ?? "";
            input.addEventListener("sl-input", (e: any) => {
                this.set(root, path, e.target.value ?? "");
            });

            this.fields.push({
                update: () => {
                    const value = this.get(root, path) ?? "";
                    if (input.value !== value) {
                        input.value = value;
                    }
                }
            });

            return this.wrapField(this.lastKey(path), input as HTMLElement);
        },
        boolean: (root, path) => {
            const value = this.get(root, path);
            const checkbox = document.createElement("sl-checkbox") as any;
            checkbox.checked = !!value;
            checkbox.addEventListener("sl-input", (e: any) => {
                this.set(root, path, !!e.target.checked);
            });

            this.fields.push({
                update: () => {
                    const value = !!this.get(root, path);
                    if (checkbox.checked !== value) {
                        checkbox.checked = value;
                    }
                }
            });

            return this.wrapField(this.lastKey(path), checkbox as HTMLElement);
        },
        color: (root, path) => {
            const value = this.get(root, path);

            const picker = document.createElement("sl-color-picker") as any;

            picker.noFormatToggle = true;
            picker.hoist = true;
            picker.value = value;
            picker.addEventListener("sl-input", (e: any) => {
                this.set(root, path, e.target.value);
            });

            this.fields.push({
                update: () => {
                    const value = this.get(root, path);
                    if (picker.value !== value) {
                        picker.value = value;
                    }
                }
            });

            return this.wrapField(this.lastKey(path), picker as HTMLElement);
        }
    };

    private static get(obj: any, path: string[]): any {
        let cur = obj;
        for (const k of path) {
            if (cur == null) return undefined;
            cur = cur[k];
        }
        return cur;
    }

    private static set(obj: any, path: string[], value: any): void {
        if (path.length === 0) throw new Error("Path must have at least one element");
        let cur = obj;
        for (let i = 0; i < path.length - 1; i++) {
            const k = path[i];
            if (!k) throw new Error("Failed to get key");

            if (cur[k] == null) cur[k] = {};
            cur = cur[k];
        }

        const index = path[path.length - 1];
        if (!index) throw new Error("Path was not found");

        cur[index] = value;
    }

    private static lastKey(path: string[]): string {
        return path.length > 0 ? path[path.length - 1] ?? "" : "";
    }

    private static isPlainObject(value: any): boolean {
        return value !== null && typeof value === "object" && !Array.isArray(value);
    }

    private static splitPascalCase(pascalCaseString: string): string {
        // This regex finds either:
        // 1. A sequence of two or more uppercase letters (e.g., "XML", "HTML") followed by a word boundary or a single uppercase letter followed by a lowercase letter.
        // 2. An optional uppercase letter followed by one or more lowercase letters.
        // 3. A single uppercase letter.
        // This helps handle acronyms and single-letter words correctly.
        const regex = /[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g;
        const words = pascalCaseString.match(regex);
        return words ? words.join(" ").toLowerCase() : pascalCaseString;
    }

    private static wrapField(labelText: string, input: HTMLElement) {
        const wrapper = document.createElement("div");
        wrapper.classList.add("inspector-field");
        const label = document.createElement("label");
        label.classList.add("inspector-label");
        label.textContent = this.splitPascalCase(labelText);

        wrapper.appendChild(label);
        wrapper.appendChild(input);
        return wrapper;
    }

    public static label(text: string) {
        return Object.assign(document.createElement("h4"), { textContent: text });
    }


    public static field(root: Component, path: string[]): HTMLElement {
        const key = this.lastKey(path);
        const value = this.get(root, path);

        // Simple primitive
        const type = typeof value;
        const isCorrectColor = isColor(value);

        if (!this.isPlainObject(value) || isCorrectColor) { //BUG: if string was changed to color like pattern -> on inspector reload it will be treated as color
            const renderer = this.fieldRenderers[isCorrectColor ? "color" : type];
            if (renderer) return renderer(root, path);
            // fallback
            const span = document.createElement("span");
            span.textContent = `[${type}]`;
            return this.wrapField(key, span);
        }

        // Nested object -> return a tree node
        return this.tree(root, path);
    }

    public static tree(root: Component, path: string[]): HTMLElement {
        const obj = this.get(root, path);
        const treeItem = document.createElement("sl-tree-item") as SlTreeItem;
        treeItem.expanded = true;
        treeItem.textContent = this.lastKey(path) || "root";

        for (const key of Object.keys(obj)) {
            if (key === "parent") continue;

            const childPath = [...path, key];
            const child = this.field(root, childPath);
            const childWrapper = document.createElement("div");
            childWrapper.appendChild(child);

            // Wrap primitive fields in tree-item
            if (this.isPlainObject(obj[key])) {
                treeItem.appendChild(child);
            } else {
                // wrap primitive field in a container tree-item
                const leafItem = document.createElement("sl-tree-item");
                leafItem.appendChild(child);
                // leafItem.expandable = false;
                treeItem.appendChild(leafItem);
            }
        }

        return treeItem;
    }

    public static build(root: Component) {
        const tree = document.createElement("sl-tree");

        for (const key of Object.keys(root)) {
            if (key === "parent") continue;
            const childPath = [key];
            const childField = this.field(root, childPath);


            if (childField.tagName !== "SL-TREE-ITEM") {
                const treeItem = document.createElement("sl-tree-item");
                treeItem.appendChild(childField);
                tree.appendChild(treeItem);
            }
            else {
                tree.appendChild(childField);
            }
        }

        return tree;
    }

    public static clearFields() {
        this.fields = [];
    }

    public static updateFields() {
        for (const field of this.fields) {
            field.update();
        }
    }
}


class InspectorComponent {
    public readonly element: SlDetails;
    public readonly component: Component;

    public constructor(component: Component) {
        this.component = component;

        this.element = Object.assign(document.createElement("sl-details") as SlDetails, {
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
        const selection = (event as CustomEvent).detail.selection as SlTreeItem[];
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