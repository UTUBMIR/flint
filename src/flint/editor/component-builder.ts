/* eslint-disable @typescript-eslint/no-explicit-any */
import type Component from "./../runtime/component";
import type { FieldBehavior } from "./fields/field-behaviour";
import type { FieldRenderer } from "./fields/field-renderer";
import { NumberRenderer } from "./fields/renderers/number-renderer";
import { WheelScrubBehavior } from "./fields/behaviours/wheel-scrub-behaviour";
import { DragScrubBehavior } from "./fields/behaviours/drag-scrub-behaviour";
import { ColorRenderer } from "./fields/renderers/color-renderer";
import { StringRenderer } from "./fields/renderers/string-renderer";
import Metadata from "../shared/metadata";
import { AngleRenderer } from "./fields/renderers/angle-renderer";
import { BooleanRenderer } from "./fields/renderers/boolean-renderer";

/**
 * Sets a custom renderer for a field
 * @param renderer - Renderer name
 */
export function customRenderer(renderer: string) {
    return (target: any, key: string) => {
        Metadata.setField(target, key, "field-renderer", renderer);
    };
}

/**
 * Hides field from inspector
 */
export function hideInInspector() {
    return (target: any, key: string) => {
        Metadata.setField(target, key, "hide-in-inspector", true);
    };
}


export class RendererRegistry {
    private static renderers: FieldRenderer[] = [];

    public static register(renderer: FieldRenderer) {
        this.renderers.push(renderer);
    }

    public static getRenderer(type: string) {
        return this.renderers.find(r => r.canRender(type));
    }
}

export class BehaviorRegistry {
    private static map = new Map<string, FieldBehavior[]>();

    static register(type: string, behavior: FieldBehavior) {
        if (!this.map.has(type)) this.map.set(type, []);
        this.map.get(type)!.push(behavior);
    }

    static getBehaviors(type: string) {
        return this.map.get(type) ?? [];
    }
}


export class ComponentBuilder {
    private static fields: { update: () => void }[] = [];

    private constructor() { }

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

    public static splitPascalCase(pascalCaseString: string, joiner: " " | "-" = " "): string {
        const regex = /[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g;
        const words = pascalCaseString.match(regex);
        return words ? words.join(joiner).toLowerCase() : pascalCaseString;
    }

    public static joinToPascalCase(str: string): string {
        if (!str) return str;

        const normalized = str
            .replace(/[-_]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        return normalized
            .split(" ")
            .map(word =>
                word.length === 0
                    ? word
                    : word[0]!.toUpperCase() + word.slice(1).toLowerCase()
            )
            .join("");
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

        let fieldParentPath = this.get(root, path.slice(0, path.length - 1));
        if (!fieldParentPath) {
            fieldParentPath = root;
        }

        const meta = Metadata.getField(fieldParentPath, key, "field-renderer");

        const render = (renderer: FieldRenderer) => {
            const wrapped = this.wrapField(this.lastKey(path),
                renderer.render(root, path, this.get, this.set) as HTMLElement);

            if (renderer.update) {
                this.fields.push({ update: renderer.update });
            }
            return wrapped;
        };

        if (meta) {
            const renderer = RendererRegistry.getRenderer(meta);
            if (renderer) {
                return render(renderer);
            }
            // fallback
            const span = document.createElement("span");
            span.textContent = `[${meta}]`;
            return this.wrapField(key, span);
        }

        if (!this.isPlainObject(value)) {
            const renderer = RendererRegistry.getRenderer(type);
            if (renderer) {
                return render(renderer);
            }
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
        const treeItem = document.createElement("sl-tree-item") as any;
        treeItem.expanded = true;
        treeItem.textContent = this.lastKey(path) || "root";

        for (const key of Object.keys(obj)) {
            if (Metadata.getField(obj, key, "hide-in-inspector")) continue;

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
                leafItem.classList.add("no-caret");
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
            if (Metadata.getField(root, key, "hide-in-inspector")) continue;

            const childPath = [key];
            const childField = this.field(root, childPath);


            if (childField.tagName !== "SL-TREE-ITEM") {
                const treeItem = document.createElement("sl-tree-item");
                treeItem.classList.add("no-caret");
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

RendererRegistry.register(new NumberRenderer());
RendererRegistry.register(new ColorRenderer());
RendererRegistry.register(new BooleanRenderer());
RendererRegistry.register(new StringRenderer());
RendererRegistry.register(new AngleRenderer());


BehaviorRegistry.register("number", new WheelScrubBehavior());
BehaviorRegistry.register("number", new DragScrubBehavior());