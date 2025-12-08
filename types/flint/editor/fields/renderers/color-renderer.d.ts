import type { FieldRenderer, GetType, SetType } from "../field-renderer";
export declare class ColorRenderer implements FieldRenderer {
    canRender(type: string): type is "color";
    render(root: any, path: string[], get: GetType, set: SetType): any;
    update(): void;
}
