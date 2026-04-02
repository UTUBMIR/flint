import { type ComponentContainer, GoldenLayout, LayoutConfig, type ResolvedComponentItemConfig, RowOrColumn } from "golden-layout";

const STORAGE_KEY = "flint.editor.layout";
const HOST_ID = "layout-host";
const HEADER_HEIGHT = 20;

type PanelType = "Viewport" | "Hierarchy" | "Assets" | "Inspector";

type PanelDefinition = {
    type: PanelType;
    templateId: string;
};

const panelDefinitions: readonly PanelDefinition[] = [
    { type: "Viewport", templateId: "viewport-panel-template" },
    { type: "Hierarchy", templateId: "hierarchy-panel-template" },
    { type: "Assets", templateId: "assets-panel-template" },
    { type: "Inspector", templateId: "inspector-panel-template" }
] as const;

const panelTemplateMap = new Map<PanelType, string>(
    panelDefinitions.map(({ type, templateId }) => [type, templateId])
);

type LiveResizeRowOrColumn = RowOrColumn & {
    _dimension: "width" | "height";
    _splitterPosition: number | null;
    _liveResizeBeforeSize: number | undefined;
    _liveResizeAfterSize: number | undefined;
    getSplitItems: (splitter: { element: HTMLElement }) => {
        before: { element: HTMLElement; size: number; updateSize: (force: boolean) => void };
        after: { element: HTMLElement; size: number; updateSize: (force: boolean) => void };
    };
    updateSize: (force: boolean) => void;
};

function installLiveSplitterResize() {
    const prototype = RowOrColumn.prototype as unknown as {
        onSplitterDragStart: (this: LiveResizeRowOrColumn, splitter: { element: HTMLElement }) => void;
        onSplitterDrag: (this: LiveResizeRowOrColumn, splitter: { element: HTMLElement }, offsetX: number, offsetY: number) => void;
        onSplitterDragStop: (this: LiveResizeRowOrColumn, splitter: { element: HTMLElement }) => void;
        __flintLiveResizeInstalled?: boolean;
    };

    if (prototype.__flintLiveResizeInstalled) {
        return;
    }

    prototype.__flintLiveResizeInstalled = true;

    const originalDragStart = prototype.onSplitterDragStart;
    const originalDrag = prototype.onSplitterDrag;
    const originalDragStop = prototype.onSplitterDragStop;

    prototype.onSplitterDragStart = function (splitter) {
        originalDragStart.call(this, splitter);

        const items = this.getSplitItems(splitter);
        this._liveResizeBeforeSize = Number.parseFloat(items.before.element.style[this._dimension]) || 0;
        this._liveResizeAfterSize = Number.parseFloat(items.after.element.style[this._dimension]) || 0;
    };

    prototype.onSplitterDrag = function (splitter, offsetX, offsetY) {
        originalDrag.call(this, splitter, offsetX, offsetY);

        if (
            this._splitterPosition === null ||
            this._liveResizeBeforeSize === undefined ||
            this._liveResizeAfterSize === undefined
        ) {
            return;
        }

        const items = this.getSplitItems(splitter);
        const beforeSize = this._liveResizeBeforeSize + this._splitterPosition;
        const afterSize = this._liveResizeAfterSize - this._splitterPosition;
        const sizeProp = this._dimension;

        items.before.element.style[sizeProp] = `${beforeSize}px`;
        items.after.element.style[sizeProp] = `${afterSize}px`;

        splitter.element.style.top = "0px";
        splitter.element.style.left = "0px";

        items.before.updateSize(false);
        items.after.updateSize(false);
    };

    prototype.onSplitterDragStop = function (splitter) {
        if (
            this._splitterPosition !== null &&
            this._liveResizeBeforeSize !== undefined &&
            this._liveResizeAfterSize !== undefined
        ) {
            const items = this.getSplitItems(splitter);
            const finalBeforeSize = this._liveResizeBeforeSize + this._splitterPosition;
            const totalSize = this._liveResizeBeforeSize + this._liveResizeAfterSize;
            const splitterPositionInRange = finalBeforeSize / totalSize;
            const totalRelativeSize = items.before.size + items.after.size;

            items.before.size = splitterPositionInRange * totalRelativeSize;
            items.after.size = (1 - splitterPositionInRange) * totalRelativeSize;

            splitter.element.style.top = "0px";
            splitter.element.style.left = "0px";

            this._liveResizeBeforeSize = undefined;
            this._liveResizeAfterSize = undefined;

            globalThis.requestAnimationFrame(() => this.updateSize(false));
            return;
        }

        originalDragStop.call(this, splitter);
    };
}

function createPanelStack(type: PanelType, title: string, size: string) {
    return {
        type: "stack" as const,
        size,
        isClosable: true,
        content: [
            {
                type: "component" as const,
                componentType: type,
                title,
                isClosable: true,
                reorderEnabled: true
            }
        ]
    };
}

function wrapComponentInStack(item: {
    componentType?: PanelType;
    title?: string;
    size?: string;
    componentState?: unknown;
}) {
    const componentType = item.componentType ?? "Viewport";
    return {
        type: "stack" as const,
        size: item.size,
        isClosable: true,
        content: [
            {
                type: "component" as const,
                componentType,
                title: item.title ?? componentType,
                componentState: item.componentState,
                isClosable: true,
                reorderEnabled: true
            }
        ]
    };
}

function createDefaultLayout(): LayoutConfig {
    return {
        root: {
            type: "row",
            content: [
                {
                    type: "column",
                    size: "80%",
                    content: [
                        {
                            type: "row",
                            size: "75%",
                            content: [
                                createPanelStack("Viewport", "Viewport", "80%"),
                                createPanelStack("Hierarchy", "Hierarchy", "20%")
                            ]
                        },
                        createPanelStack("Assets", "Assets", "25%")
                    ]
                },
                createPanelStack("Inspector", "Inspector", "20%")
            ]
        },
        settings: {
            reorderEnabled: true,
            popoutWholeStack: false,
            showPopoutIcon: false,
            showMaximiseIcon: true,
            showCloseIcon: true
        },
        dimensions: {
            defaultMinItemHeight: "180px",
            defaultMinItemWidth: "220px",
            headerHeight: HEADER_HEIGHT,
            borderWidth: 5
        },
        header: {
            show: "top",
            popout: false,
            maximise: "max",
            close: "Close",
            tabDropdown: "more"
        }
    };
}

function getTemplateElement(id: string): HTMLElement {
    const element = document.getElementById(id);
    if (!element || !(element instanceof HTMLElement)) {
        throw new Error(`Layout template "${id}" was not found.`);
    }

    return element;
}

function bindPanelComponent(container: ComponentContainer, itemConfig: ResolvedComponentItemConfig) {
    const componentTypeValue = itemConfig.componentType;
    if (typeof componentTypeValue !== "string") {
        throw new Error("GoldenLayout item is missing component type.");
    }

    const componentType = componentTypeValue as PanelType;
    const templateId = panelTemplateMap.get(componentType);
    if (!templateId) {
        throw new Error(`Unknown GoldenLayout component type "${componentType}".`);
    }

    const template = getTemplateElement(templateId);
    container.element.appendChild(template);

    return {
        component: {
            rootHtmlElement: template,
            templateId
        },
        virtual: false
    };
}

function unbindPanelComponent(container: ComponentContainer) {
    const templatesHost = document.getElementById("layout-templates");
    if (!templatesHost || !(templatesHost instanceof HTMLElement)) {
        return;
    }

    const panelRoot = container.element.firstElementChild;
    if (panelRoot instanceof HTMLElement) {
        templatesHost.appendChild(panelRoot);
    }
}

function loadStoredLayout(): LayoutConfig | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return null;
    }

    try {
        return JSON.parse(raw) as LayoutConfig;
    } catch {
        localStorage.removeItem(STORAGE_KEY);
        return null;
    }
}

function makeItemDockable(item: unknown): unknown {
    if (!item || typeof item !== "object") {
        return item;
    }

    const typedItem = item as {
        type?: string;
        content?: unknown[];
        title?: string;
        componentType?: PanelType;
        size?: string;
        componentState?: unknown;
        isClosable?: boolean;
        reorderEnabled?: boolean;
        header?: Record<string, unknown>;
    };

    if (typedItem.type === "component") {
        return wrapComponentInStack(typedItem);
    }

    if (typedItem.type === "stack") {
        return {
            ...typedItem,
            isClosable: true,
            header: {
                ...typedItem.header,
                close: "Close"
            },
            content: typedItem.content?.map(makeItemDockable)
        };
    }

    if ((typedItem.type === "row" || typedItem.type === "column") && typedItem.content) {
        return {
            ...typedItem,
            content: typedItem.content.map(makeItemDockable)
        };
    }

    return typedItem;
}

function normalizeLayoutConfig(layoutConfig: LayoutConfig): LayoutConfig {
    return {
        ...layoutConfig,
        root: layoutConfig.root ? makeItemDockable(layoutConfig.root) as LayoutConfig["root"] : layoutConfig.root,
        settings: {
            ...layoutConfig.settings,
            reorderEnabled: true,
            popoutWholeStack: false,
            showPopoutIcon: false,
            showMaximiseIcon: true,
            showCloseIcon: true
        },
        dimensions: {
            ...layoutConfig.dimensions,
            headerHeight: HEADER_HEIGHT
        },
        header: {
            ...layoutConfig.header,
            show: "top",
            popout: false,
            maximise: "max",
            close: "Close",
            tabDropdown: "more"
        }
    };
}

function saveLayout(layout: GoldenLayout) {
    const resolved = layout.saveLayout();
    const serializable = LayoutConfig.fromResolved(resolved);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(serializable));
}

export function initializeEditorLayout(): GoldenLayout {
    installLiveSplitterResize();

    const host = document.getElementById(HOST_ID);
    if (!host || !(host instanceof HTMLElement)) {
        throw new Error(`Layout host "${HOST_ID}" was not found.`);
    }

    const layout = new GoldenLayout(host, bindPanelComponent, unbindPanelComponent);

    let saveTimeout: number | undefined;
    layout.addEventListener("stateChanged", () => {
        window.clearTimeout(saveTimeout);
        saveTimeout = window.setTimeout(() => {
            saveLayout(layout);
        }, 100);
    });

    const layoutConfig = normalizeLayoutConfig(loadStoredLayout() ?? createDefaultLayout());

    try {
        layout.loadLayout(layoutConfig);
    } catch (error) {
        console.warn("Failed to load stored GoldenLayout config, restoring defaults.", error);
        localStorage.removeItem(STORAGE_KEY);
        layout.loadLayout(createDefaultLayout());
    }

    return layout;
}
