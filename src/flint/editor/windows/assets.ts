import { Project } from "../project/project";
import ProjectConfig from "../project/project-config";
import { BaseEditorWindow, type EditorWindowState, type WindowContext } from "../window-framework";
import type { AssetData } from "../asset-types";

export default class AssetsWindow extends BaseEditorWindow {
    private readonly gridElement: HTMLDivElement;
    private readonly contextDropdownElement: HTMLElement & { show: () => void; reposition: () => void };
    private readonly contextMenuElement: HTMLElement;
    private readonly backButton: HTMLButtonElement;
    private cachedWidth = 0;
    private cachedHeight = 0;
    private scheduledRerender = false;
    private currentPath = "/assets";
    private allAssets: AssetData[] = [];

    public constructor(context: WindowContext) {
        super(context);

        this.root.className = "panel-content";
        this.root.innerHTML = `
            <div class="panel-body assets-panel-body">
                <sl-dropdown data-role="context-dropdown" style="position: absolute;">
                    <sl-menu data-role="context-menu">
                        <sl-menu-label>Create</sl-menu-label>
                        <sl-menu-item data-role="new-folder" value="new-folder">
                            <sl-icon slot="prefix" name="folder2-open"></sl-icon>
                            New folder
                        </sl-menu-item>
                        <sl-menu-item data-role="new-component" value="new-component">
                            <sl-icon slot="prefix" name="code-slash"></sl-icon>
                            New component
                        </sl-menu-item>
                        <sl-menu-item data-role="new-json" value="new-json">
                            <sl-icon slot="prefix" name="text-left"></sl-icon>
                            New JSON file
                        </sl-menu-item>
                    </sl-menu>
                </sl-dropdown>
                <sl-tooltip content="Go to previous folder">
                    <sl-icon-button data-role="back-button" class="floating-panel-action"
                        name="arrow-90deg-left"></sl-icon-button>
                </sl-tooltip>
                <div data-role="assets-grid"></div>
            </div>
        `;

        this.gridElement = this.query<HTMLDivElement>('[data-role="assets-grid"]');
        this.contextDropdownElement = this.query('[data-role="context-dropdown"]') as HTMLElement & { show: () => void; reposition: () => void };
        this.contextMenuElement = this.query('[data-role="context-menu"]');
        this.backButton = this.query('[data-role="back-button"]');
    }

    public override initialize(): void {
        this.setupButtons();
        this.setupContextMenu();
        this.registerCleanup(this.context.services.assets.subscribe(assets => {
            this.allAssets = [...assets];
            this.requestRerender();
        }));
        this.requestRerender();
    }

    public override onActivate(): void {
        this.context.services.activeWindows.setActiveWindow("Assets", this.instanceId);
        this.context.services.activeWindows.setAssetsWindowPath(this.instanceId, this.currentPath);
    }

    public override serializeState(): EditorWindowState {
        return {
            currentPath: this.currentPath
        };
    }

    public override restoreState(state: EditorWindowState): void {
        const currentPath = state?.currentPath;
        if (typeof currentPath === "string" && currentPath.length > 0) {
            this.currentPath = currentPath;
        }
    }

    public getCurrentPath(): string {
        return this.currentPath;
    }

    private setupButtons(): void {
        const buttonConfigs: { selector: string; type: AssetData["type"]; label: string }[] = [
            { selector: '[data-role="new-folder"]', type: "folder", label: "New Folder" },
            { selector: '[data-role="new-json"]', type: "json", label: "New JSON" }
        ];

        for (const config of buttonConfigs) {
            this.listen(this.query(config.selector), "click", () => {
                const siblings = this.allAssets.filter(asset => asset.path.startsWith(this.currentPath + "/") && asset.type === config.type);
                const count = siblings.length + 1;
                this.context.services.assets.add({
                    id: crypto.randomUUID(),
                    name: `${config.label} ${count}`,
                    type: config.type,
                    path: `${this.currentPath}${this.currentPath === "/" ? "" : "/"}${config.label} ${count}`,
                    data: ""
                });
            });
        }

        this.listen(this.query('[data-role="new-component"]'), "click", () => {
            this.onActivate();
            Project.showCreateComponentWindow();
        });

        this.listen(this.backButton, "click", () => {
            this.goBack();
        });
    }

    private setupContextMenu(): void {
        this.listen(this.contextDropdownElement, "sl-after-show" as keyof HTMLElementEventMap, () => {
            if (this.cachedWidth === 0) {
                this.cachedWidth = this.contextMenuElement.clientWidth;
                this.cachedHeight = this.contextMenuElement.clientHeight;
            }
        });

        this.listen(this.gridElement, "contextmenu", event => {
            event.preventDefault();
            if (event.target !== this.gridElement) {
                return;
            }

            this.contextDropdownElement.show();
            if (this.cachedWidth === 0) {
                this.positionDropdown(event);
                this.contextDropdownElement.addEventListener("sl-after-show", () => this.positionDropdown(event), { once: true });
            } else {
                this.positionDropdown(event);
            }
        });
    }

    private positionDropdown(event: MouseEvent): void {
        const container = this.contextDropdownElement.offsetParent instanceof HTMLElement
            ? this.contextDropdownElement.offsetParent
            : this.root;
        const rect = container.getBoundingClientRect();
        const scrollLeft = container.scrollLeft;
        const scrollTop = container.scrollTop;
        const maxX = Math.max(scrollLeft, scrollLeft + container.clientWidth - this.cachedWidth);
        const maxY = Math.max(scrollTop, scrollTop + container.clientHeight - this.cachedHeight);
        const x = Math.min(maxX, Math.max(scrollLeft, event.clientX - rect.left + scrollLeft));
        const y = Math.min(maxY, Math.max(scrollTop, event.clientY - rect.top + scrollTop));

        Object.assign(this.contextDropdownElement.style, { left: `${x}px`, top: `${y}px` });
        this.contextDropdownElement.reposition();
    }

    public requestRerender(): void {
        if (this.scheduledRerender) {
            return;
        }

        this.scheduledRerender = true;
        queueMicrotask(() => {
            this.scheduledRerender = false;
            this.renderCurrentFolder();
        });
    }

    private goBack(): void {
        if (this.currentPath === "/") {
            return;
        }

        const parts = this.currentPath.split("/").filter(Boolean);
        parts.pop();
        this.currentPath = "/" + parts.join("/");
        if (this.currentPath === "") {
            this.currentPath = "/";
        }
        this.context.services.activeWindows.setAssetsWindowPath(this.instanceId, this.currentPath);
        this.requestRerender();
    }

    private enterFolder(path: string): void {
        this.currentPath = path;
        this.context.services.activeWindows.setAssetsWindowPath(this.instanceId, this.currentPath);
        this.requestRerender();
    }

    private renderCurrentFolder(): void {
        this.gridElement.innerHTML = "";

        const parentPath = this.currentPath === "/" ? "/" : this.currentPath + "/";
        const children = this.allAssets
            .filter(asset => {
                const rest = asset.path.replace(parentPath, "");
                return asset.path.startsWith(parentPath) && !rest.includes("/");
            })
            .sort((a, b) => {
                const typeOrder = (asset: AssetData) => {
                    if (asset.type === "folder") return 0;
                    if (asset.type === "component") return 1;
                    if (asset.type === "json") return 2;
                    return 3;
                };

                const typeDiff = typeOrder(a) - typeOrder(b);
                if (typeDiff !== 0) return typeDiff;

                const nameA = a.name.toLowerCase();
                const nameB = b.name.toLowerCase();
                return nameA < nameB ? -1 : nameA > nameB ? 1 : 0;
            });

        for (const child of children) {
            this.renderAsset(child);
        }

        this.backButton.disabled = this.currentPath === "/";
    }

    private getIconForType(type: AssetData["type"]): string {
        return type === "folder" ? "folder2-open"
            : type === "component" ? "code-slash"
                : type === "json" ? "text-left"
                    : "file";
    }

    private renderAsset(asset: AssetData): void {
        const card = document.createElement("div");
        card.className = "asset-card";
        card.draggable = asset.type === "component";
        card.dataset.path = asset.path;
        card.innerHTML = `
            <sl-card class="asset-card-inner">
                <sl-icon name="${this.getIconForType(asset.type)}" class="asset-icon"></sl-icon>
                <span class="asset-name">${asset.name}</span>
            </sl-card>
        `;

        if (asset.type === "component") {
            if (asset.data === undefined) {
                const found = ProjectConfig.config.components.find(component => component.file === asset.path)?.name;
                asset.data = found ?? "";
            }

            card.addEventListener("dragstart", event => {
                event.dataTransfer?.items.add(asset.data, "application/x-component-name");
            });
        }

        card.addEventListener("mousedown", () => this.onActivate());
        card.addEventListener("dblclick", async () => {
            this.onActivate();
            if (asset.type === "folder") {
                this.enterFolder(asset.path);
            } else {
                await Project.openInFileEditor(asset.path);
            }
        });

        this.gridElement.appendChild(card);
    }
}
