import Layer from "../../runtime/layer";
import { type DropdownType } from "../editor";
/**
 * Sets a name for and object, exists only in the Editor.
 * @param name - Name to show in the Editor.
 */
export declare function editorName(name: string): (target: any) => void;
export default class Hierarchy {
    element: HTMLElement;
    layers: Map<number, Layer>;
    private selection;
    contextDropdownElement: DropdownType;
    contextMenuElement: HTMLElement;
    private cachedWidth;
    private cachedHeight;
    constructor(element: HTMLElement);
    private setupContextMenu;
    private positionDropdown;
    private onSelectionChange;
    createObject(): void;
    onUpdate(): Promise<void>;
    addItem(text: string, id: string, parent: HTMLElement): HTMLElement;
}
