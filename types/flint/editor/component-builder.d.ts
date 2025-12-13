import type Component from "./../runtime/component";
import type { FieldBehavior } from "./fields/field-behaviour";
import type { FieldRenderer } from "./fields/field-renderer";
/**
 * Sets a custom renderer for a field
 * @param renderer - Renderer name
 */
export declare function FieldRenderer(renderer: string): (target: any, key: string) => void;
/**
 * Hides field from inspector
 */
export declare function HideInInspector(): (target: any, key: string) => void;
export declare class RendererRegistry {
    private static renderers;
    static register(renderer: FieldRenderer): void;
    static getRenderer(type: string): FieldRenderer | undefined;
}
export declare class BehaviorRegistry {
    private static map;
    static register(type: string, behavior: FieldBehavior): void;
    static getBehaviors(type: string): FieldBehavior[];
}
export declare class ComponentBuilder {
    private static fields;
    private constructor();
    private static get;
    private static set;
    private static lastKey;
    private static isPlainObject;
    static splitPascalCase(pascalCaseString: string, joiner?: " " | "-"): string;
    static joinToPascalCase(str: string): string;
    private static wrapField;
    static label(text: string): HTMLHeadingElement & {
        textContent: string;
    };
    static field(root: Component, path: string[]): HTMLElement;
    static tree(root: Component, path: string[]): HTMLElement;
    static build(root: Component): HTMLElement;
    static clearFields(): void;
    static updateFields(): void;
}
