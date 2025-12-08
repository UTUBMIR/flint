import type { FieldRenderer, GetType, SetType } from "../field-renderer";
export declare class NumberRenderer implements FieldRenderer {
    canRender(type: string): type is "number";
    render(root: any, path: string[], get: GetType, set: SetType): any;
    update(): void;
}
