import type { FieldRenderer, GetType, SetType } from "../field-renderer";
export declare class BooleanRenderer implements FieldRenderer {
    canRender(type: string): type is "boolean";
    render(root: any, path: string[], get: GetType, set: SetType): any;
    update(): void;
}
