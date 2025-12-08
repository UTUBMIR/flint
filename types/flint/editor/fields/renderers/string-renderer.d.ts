import type { FieldRenderer, GetType, SetType } from "../field-renderer";
export declare class StringRenderer implements FieldRenderer {
    canRender(type: string): type is "string";
    render(root: any, path: string[], get: GetType, set: SetType): any;
    update(): void;
}
