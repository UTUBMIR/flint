/* eslint-disable @typescript-eslint/no-explicit-any */
import Component from "@flint/runtime/component";
import GameObject from "@flint/runtime/game-object";
import type { FieldBehavior } from "./field-behaviour";
import type { FieldRenderer } from "./field-renderer";
import { NumberRenderer } from "./renderers/number-renderer";
import { WheelScrubBehavior } from "./behaviours/wheel-scrub-behaviour";
import { DragScrubBehavior } from "./behaviours/drag-scrub-behaviour";
import { ColorRenderer } from "./renderers/color-renderer";
import { StringRenderer } from "./renderers/string-renderer";
import Metadata, { MetadataKeys } from "@flint/shared/metadata";
import { AngleRenderer } from "./renderers/angle-renderer";
import { BooleanRenderer } from "./renderers/boolean-renderer";
import { GameObjectRenderer } from "./renderers/game-object-renderer";
import { ComponentRenderer } from "./renderers/component-renderer";
import { SelectRenderer } from "./renderers/select-renderer";
import { CasingHandler } from "../casing-handler";


export class RendererRegistry {
    private static renderers: FieldRenderer[] = [];

    public static register(renderer: FieldRenderer) {
        this.renderers.push(renderer);
    }

    public static getRendererByValue(type: any) {
        if (type == null) return undefined;

        function check(r: { canRender: (t: string) => boolean }, t: any) {
            if (RendererRegistry.isComponentValue(t) && r.canRender("component")) return true;
            if (RendererRegistry.isGameObjectValue(t) && r.canRender("gameobject")) return true;

            const tTypeof = typeof t;
            const ctorName = t?.constructor?.name?.toLowerCase();
            return r.canRender(tTypeof) || (ctorName ? r.canRender(ctorName) : false);
        }

        return this.renderers.find(r => {
            let current = type;
            while (current) {
                if (check(r, current)) {
                    return true;
                }
                current = Object.getPrototypeOf(current);
            }
            return false;
        });
    }

    public static getRendererByTypeName(typeName: string) {
        return this.renderers.find(r => (r.canRender(typeName.toLowerCase())));
    }

    private static isComponentValue(value: any): boolean {
        return value instanceof Component || (
            value !== null &&
            typeof value === "object" &&
            "transform" in value &&
            typeof value.attach === "function" &&
            typeof value.start === "function" &&
            typeof value.update === "function" &&
            typeof value.detach === "function" &&
            typeof value.destroy === "function"
        );
    }

    private static isGameObjectValue(value: any): boolean {
        return value instanceof GameObject || (
            value !== null &&
            typeof value === "object" &&
            typeof value.id === "string" &&
            typeof value.addComponent === "function" &&
            typeof value.getAllComponents === "function" &&
            value.transform !== null &&
            typeof value.transform === "object"
        );
    }
}

export class BehaviorRegistry {
    private static map = new Map<string, FieldBehavior[]>();

    public static register(type: string, behavior: FieldBehavior) {
        if (!this.map.has(type)) this.map.set(type, []);
        this.map.get(type)!.push(behavior);
    }

    public static getBehaviors(type: string) {
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



    private static wrapField(labelText: string, input: HTMLElement) {
        const wrapper = document.createElement("div");
        wrapper.classList.add("inspector-field");
        const label = document.createElement("label");
        label.classList.add("inspector-label");
        label.textContent = CasingHandler.splitPascalCase(labelText);

        wrapper.appendChild(label);
        wrapper.appendChild(input);
        return wrapper;
    }

    public static label(text: string) {
        return Object.assign(document.createElement("h4"), { textContent: text });
    }


    public static field(root: Component, path: string[], seen = new WeakSet<object>()): HTMLElement {
        const key = this.lastKey(path);
        const value = this.get(root, path);

        // Simple primitive
        const type = typeof value;

        let fieldParentPath = this.get(root, path.slice(0, path.length - 1));
        if (!fieldParentPath) {
            fieldParentPath = root;
        }

        const meta = Metadata.getField(fieldParentPath, key, MetadataKeys.FieldInspector);

        const render = (renderer: FieldRenderer) => {
            const wrapped = this.wrapField(this.lastKey(path),
                renderer.render(root, path, this.get, this.set) as HTMLElement);

            if (renderer.update) {
                this.fields.push({ update: renderer.update });
            }
            return wrapped;
        };

        if (meta) {
            const renderer = RendererRegistry.getRendererByTypeName(meta);
            if (renderer) {
                return render(renderer);
            }
            // fallback
            const span = document.createElement("span");
            span.textContent = `[${meta}]`;
            return this.wrapField(key, span);
        }

        const renderer = RendererRegistry.getRendererByValue(value) ?? RendererRegistry.getRendererByTypeName(type);
        if (!this.isPlainObject(value) || renderer) {
            if (renderer) {
                return render(renderer);
            }

            // fallback
            const span = document.createElement("span");
            span.textContent = `[${type}]`;
            return this.wrapField(key, span);
        }

        // Nested object -> return a tree node
        return this.tree(root, path, seen);
    }

    public static tree(root: Component, path: string[], seen = new WeakSet<object>()): HTMLElement {
        const obj = this.get(root, path);
        const treeItem = document.createElement("sl-tree-item") as any;
        treeItem.expanded = true;
        treeItem.textContent = this.lastKey(path) || "root";

        if (obj && typeof obj === "object") {
            if (seen.has(obj)) {
                treeItem.textContent = `${this.lastKey(path) || "root"} [Circular]`;
                return treeItem;
            }

            seen.add(obj);
        }

        for (const key of Object.keys(obj)) {
            if (Metadata.getField(root, key, MetadataKeys.HideInInspector) ??
                Metadata.getField(root, key, MetadataKeys.NonSerialized)) continue;

            const childPath = [...path, key];
            const child = this.field(root, childPath, seen);
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
            if (Metadata.getField(root, key, MetadataKeys.HideInInspector) ??
                Metadata.getField(root, key, MetadataKeys.NonSerialized)) continue;

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
RendererRegistry.register(new SelectRenderer());

RendererRegistry.register(new GameObjectRenderer());
RendererRegistry.register(new ComponentRenderer());

BehaviorRegistry.register("number", new WheelScrubBehavior());
BehaviorRegistry.register("number", new DragScrubBehavior());
