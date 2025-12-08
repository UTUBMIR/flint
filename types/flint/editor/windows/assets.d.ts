import { type DropdownType } from "../editor";
export type AssetData = {
    id: string;
    name: string;
    type: "folder" | "component" | "json";
    path: string;
    data: string;
};
export default class Assets {
    element: HTMLDivElement;
    gridElement: HTMLDivElement;
    contextDropdownElement: DropdownType;
    contextMenuElement: HTMLElement;
    private cachedWidth;
    private cachedHeight;
    private allAssets;
    currentPath: string;
    private backButton;
    constructor(element: HTMLDivElement, gridElement: HTMLDivElement);
    private setupButtons;
    private updateBackButton;
    private goBack;
    private setupContextMenu;
    private positionDropdown;
    /** Adds asset to store and re-renders current folder */
    addAsset(asset: AssetData): void;
    /** Removes asset and all nested assets if folder */
    removeAsset(path: string): void;
    /** Clears all assets */
    clearAssets(): void;
    /** Renders only assets in the current folder */
    private renderCurrentFolder;
    private getIconForType;
    private renderAsset;
    private setupAssetNameEdit;
    private enterFolder;
    private onAssetOpen;
}
