import Layer from "../runtime/layer";
import Assets from "./windows/assets";
import HierarchyWindow from "./windows/hierarchy";
import InspectorWindow from "./windows/inspector";
export type DropdownType = HTMLElement & {
    show: () => void;
    hide: () => void;
    reposition: () => void;
};
export declare class Notifier {
    static escapeHtml(html: string): string;
    static notify(message: string, variant: "primary" | "success" | "neutral" | "warning" | "danger", duration?: number): Promise<void>;
}
export default class Editor {
    static draggedItem: unknown | undefined;
    static hierarchyWindow: HierarchyWindow;
    static inspectorWindow: InspectorWindow;
    static assetsWindow: Assets;
    static runButton: HTMLButtonElement;
    static runButtonIcon: {
        name: string;
    };
    static loadingDialog: HTMLElement & {
        show: () => void;
        hide: () => void;
    };
    static loadingDialogProgressBar: HTMLElement & {
        value: number;
        indeterminate: boolean;
    };
    private static _defaultLayer;
    static get defaultLayer(): Layer;
    private static _running;
    static get running(): boolean;
    private constructor();
    static init(): void;
    static loadEngineFiles(): Promise<void>;
    static updateInspectorFields(): void;
    static onProjectLoad(): void;
}
