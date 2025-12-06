import { ComponentBuilder } from "../component-builder";
import { Project } from "../project/project";
import { type DropdownType } from "../editor";

export type AssetData = {
    id: string;
    name: string;
    type: "folder" | "component" | "json";
    path: string; // Full path, e.g., "/Folder 1/Component 1"
};

export default class Assets {
    public element: HTMLDivElement;
    public gridElement: HTMLDivElement;
    public contextDropdownElement: DropdownType;
    public contextMenuElement: HTMLElement;

    private cachedWidth = 0;
    private cachedHeight = 0;
    private allAssets: AssetData[] = [];
    public currentPath = "/"; // tracks which folder we are currently in
    private backButton: HTMLButtonElement;

    constructor(element: HTMLDivElement, gridElement: HTMLDivElement) {
        this.element = element;
        this.gridElement = gridElement;

        this.contextDropdownElement = this.element.querySelector("#assets-context-dropdown") as DropdownType;
        this.contextMenuElement = this.contextDropdownElement.querySelector("#assets-context-menu") as HTMLElement;


        this.backButton = document.getElementById("assets-back-button") as HTMLButtonElement;

        this.setupButtons();
        this.setupContextMenu();
        this.renderCurrentFolder();
    }

    private setupButtons() {
        const buttonConfigs: { id: string; type: AssetData["type"]; label: string }[] = [
            { id: "new-folder-button", type: "folder", label: "New Folder" },
            { id: "new-json-button", type: "json", label: "New JSON" }
        ];

        buttonConfigs.forEach(({ id, type, label }) => {
            document.getElementById(id)!.addEventListener("click", () => {
                const siblings = this.allAssets.filter(a => a.path.startsWith(this.currentPath + "/") && a.type === type);
                const count = siblings.length + 1;
                const newAsset: AssetData = {
                    id: crypto.randomUUID(),
                    name: `${label} ${count}`,
                    type,
                    path: `${this.currentPath}${this.currentPath === "/" ? "" : "/"}${label} ${count}`
                };
                this.addAsset(newAsset);
            });
        });

        document.getElementById("new-component-button")!.addEventListener("click", () => {
            Project.showCreateComponentWindow();
        });

        this.backButton.addEventListener("click", () => {
            this.goBack();
            this.updateBackButton();
        });

        this.updateBackButton();
    }

    private updateBackButton() {
        this.backButton.disabled = this.currentPath === "/";
    };

    private goBack() {
        if (this.currentPath === "/") return; // already at root
        const parts = this.currentPath.split("/").filter(Boolean);
        parts.pop(); // go up one folder
        this.currentPath = "/" + parts.join("/");
        if (this.currentPath === "") this.currentPath = "/";
        this.renderCurrentFolder();
    }


    private setupContextMenu() {
        this.contextDropdownElement.addEventListener("sl-after-show", () => {
            if (this.cachedWidth === 0) {
                this.cachedWidth = this.contextMenuElement.clientWidth;
                this.cachedHeight = this.contextMenuElement.clientHeight;
            }
        });

        this.element.addEventListener("contextmenu", (e) => {
            e.preventDefault();
            this.contextDropdownElement.show();

            if (this.cachedWidth === 0) {
                this.positionDropdown(e);
                this.contextDropdownElement.addEventListener(
                    "sl-after-show",
                    () => this.positionDropdown(e),
                    { once: true }
                );
            } else {
                this.positionDropdown(e);
            }
        });
    }

    private positionDropdown(e: MouseEvent) {
        const x = Math.min(document.body.clientWidth - this.cachedWidth, e.pageX);
        const y = Math.min(document.body.clientHeight - this.cachedHeight, e.pageY);

        Object.assign(this.contextDropdownElement.style, { left: `${x}px`, top: `${y}px` });
        this.contextDropdownElement.reposition();
    }

    /** Adds asset to store and re-renders current folder */
    public addAsset(asset: AssetData) {
        this.allAssets.push(asset);
        this.renderCurrentFolder();
    }

    /** Removes asset and all nested assets if folder */
    public removeAsset(path: string) {
        this.allAssets = this.allAssets.filter(a => !a.path.startsWith(path));
        this.renderCurrentFolder();
    }

    /** Clears all assets */
    public clearAssets() {
        this.allAssets = [];
        this.renderCurrentFolder();
    }

    /** Renders only assets in the current folder */
    private renderCurrentFolder() {
        this.gridElement.innerHTML = "";

        const parentPath = this.currentPath === "/" ? "/" : this.currentPath + "/";
        const children = this.allAssets
            .filter(a => {
                const rest = a.path.replace(parentPath, "");
                return a.path.startsWith(parentPath) && !rest.includes("/");
            })
            .sort((a, b) => {
                const typeOrder = (asset: AssetData) => {
                    if (asset.type === "folder") return 0;
                    if (asset.path.endsWith(".json")) return 2;
                    return 1; // components
                };

                const typeDiff = typeOrder(a) - typeOrder(b);
                if (typeDiff !== 0) return typeDiff;

                // sorting by name inside type
                const nameA = a.name.toLowerCase();
                const nameB = b.name.toLowerCase();
                return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
            });

        children.forEach(a => this.renderAsset(a));
        this.updateBackButton();
    }


    private getIconForType(type: AssetData["type"]) {
        return type === "folder" ? "folder2" :
            type === "component" ? "code-slash" :
                type === "json" ? "text-left" : "file";
    }

    private renderAsset(asset: AssetData) {
        const card = document.createElement("div");
        card.className = "asset-card";
        card.draggable = true;
        card.dataset.path = asset.path;

        card.innerHTML = `
            <sl-card class="asset-card-inner">
                <sl-icon name="${this.getIconForType(asset.type)}" class="asset-icon"></sl-icon>
                <span class="asset-name">${asset.name}</span>
            </sl-card>
        `;

        const nameEl = card.querySelector(".asset-name") as HTMLSpanElement;

        if (asset.type !== "folder") {
            function dragstartHandler(ev: DragEvent) {
                ev.dataTransfer!.items.add(ComponentBuilder.joinToPascalCase(asset.path.split("/").pop()!.split(".")[0]!), "text/plain");
                console.log(`Dragging asset: ${asset.path}`);
            }

            card.addEventListener("dragstart", dragstartHandler);
        }

        card.addEventListener("dblclick", async () => {
            if (asset.type === "folder") {
                this.enterFolder(asset.path);
            } else {
                await this.onAssetOpen(asset);
            }
        });
        this.setupAssetNameEdit(nameEl, asset);

        this.gridElement.appendChild(card);
    }

    private setupAssetNameEdit(_nameEl: HTMLSpanElement, _asset: AssetData) {
        // nameEl.addEventListener("dblclick", async () => {
        //     if (nameEl.querySelector("sl-input")) return;

        //     const oldLabel = nameEl.textContent || "";
        //     const input = document.createElement("sl-input") as HTMLInputElement;
        //     input.type = "text";
        //     input.value = oldLabel;
        //     input.style.width = "120px";

        //     nameEl.textContent = "";
        //     nameEl.appendChild(input);

        //     await customElements.whenDefined("sl-input");

        //     input.focus();
        //     input.select();

        //     const exitEdit = (save: boolean) => {
        //         const newText = save ? input.value || oldLabel : oldLabel;
        //         const oldPath = asset.path;
        //         asset.name = newText;
        //         asset.path = oldPath.split("/").slice(0, -1).concat(newText).join("/") || "/";
        //         nameEl.textContent = newText;
        //         input.remove();
        //         this.renderCurrentFolder();
        //     };

        //     input.addEventListener("sl-blur", () => exitEdit(true));
        //     input.addEventListener("keydown", (e: KeyboardEvent) => {
        //         if (e.key === "Enter") exitEdit(true);
        //         if (e.key === "Escape") exitEdit(false);
        //     });
        // });TODO: Implement this
    }

    private enterFolder(path: string) {
        this.currentPath = path;
        this.renderCurrentFolder();
    }

    private async onAssetOpen(asset: AssetData) {
        if (asset.type === "folder") return;
        await Project.openInFileEditor(asset.path);
    }
}