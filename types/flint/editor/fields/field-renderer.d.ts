export type GetType = (obj: any, path: string[]) => any;
export type SetType = (obj: any, path: string[], value: any) => void;
export interface FieldRenderer {
    canRender(type: string): boolean;
    render(root: any, path: string[], get: GetType, set: SetType): HTMLElement;
    update?(): void;
}
