import { type ComponentContainer, GoldenLayout, LayoutConfig, type ResolvedComponentItemConfig, RowOrColumn } from "golden-layout";
import { CodeEditor } from "./code-editor";
import { FloatingPanelManager, type FloatingPanelState } from "./floating-panels";

const STORAGE_KEY = "flint.editor.layout";
const HOST_ID = "layout-host";
const STORAGE_VERSION = 2;
const HEADER_HEIGHT = 20;
let currentLayout: GoldenLayout | null = null;
let currentFloatingPanels: FloatingPanelManager | null = null;

type PanelType = "Viewport" | "CodeEditor" | "Hierarchy" | "Assets" | "Inspector";

type PanelDefinition = {
    type: PanelType;
    templateId: string;
};

const panelDefinitions: readonly PanelDefinition[] = [
    { type: "Viewport", templateId: "viewport-panel-template" },
    { type: "CodeEditor", templateId: "code-editor-panel-template" },
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

type AnimatedDropTargetIndicator = {
    _element?: HTMLElement;
    highlightArea: (area: { x1: number; y1: number; x2: number; y2: number }, margin: number) => void;
    hide: () => void;
    __flintAnimationInstalled?: boolean;
    __flintHideTimeout?: number;
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

function installAnimatedDropTargetIndicator(layout: GoldenLayout) {
    const internalLayout = layout as GoldenLayout & {
        dropTargetIndicator?: AnimatedDropTargetIndicator | null;
    };

    const indicator = internalLayout.dropTargetIndicator;
    if (!indicator || indicator.__flintAnimationInstalled) {
        return;
    }

    const element = indicator._element;
    if (!(element instanceof HTMLElement)) {
        return;
    }

    indicator.__flintAnimationInstalled = true;
    const originalHighlightArea = indicator.highlightArea.bind(indicator);

    indicator.highlightArea = (area, margin) => {
        window.clearTimeout(indicator.__flintHideTimeout);
        element.classList.remove("flint-drop-target-fading");
        originalHighlightArea(area, margin);
        element.classList.add("flint-drop-target-visible");
    };

    indicator.hide = () => {
        window.clearTimeout(indicator.__flintHideTimeout);
        element.classList.remove("flint-drop-target-visible");
        element.classList.add("flint-drop-target-fading");
        indicator.__flintHideTimeout = window.setTimeout(() => {
            element.classList.remove("flint-drop-target-fading");
            element.style.display = "none";
        }, 140);
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

function createViewportAndEditorStack() {
    return {
        type: "stack" as const,
        size: "75%",
        isClosable: true,
        content: [
            {
                type: "component" as const,
                componentType: "Viewport",
                title: "Viewport",
                isClosable: true,
                reorderEnabled: true
            },
            {
                type: "component" as const,
                componentType: "CodeEditor",
                title: "Code Editor",
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
                            size: "80%",
                            content: [
                                createViewportAndEditorStack(),
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

    if (componentType === "CodeEditor") {
        const codeEditorContainer = template.querySelector("#code-editor-container");
        if (codeEditorContainer instanceof HTMLElement) {
            CodeEditor.init(codeEditorContainer, container);
        }
    }

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

type StoredLayoutSnapshot = {
    version: number;
    dockedLayout: LayoutConfig;
    floatingPanels: FloatingPanelState[];
};

function loadStoredLayout(): StoredLayoutSnapshot | null {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
        return null;
    }

    try {
        const parsed = JSON.parse(raw) as Partial<StoredLayoutSnapshot> & LayoutConfig;
        if ("dockedLayout" in parsed) {
            return {
                version: typeof parsed.version === "number" ? parsed.version : STORAGE_VERSION,
                dockedLayout: parsed.dockedLayout ?? createDefaultLayout(),
                floatingPanels: Array.isArray(parsed.floatingPanels) ? parsed.floatingPanels : []
            };
        }

        return {
            version: STORAGE_VERSION,
            dockedLayout: parsed as LayoutConfig,
            floatingPanels: []
        };
    } catch {
        localStorage.removeItem(STORAGE_KEY);
        return null;
    }
}

function makeItemDockable(item: unknown, parentType?: string): unknown {
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

    if (typedItem.type === "component" && parentType !== "stack") {
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
            content: typedItem.content?.map(child => makeItemDockable(child, "stack"))
        };
    }

    if ((typedItem.type === "row" || typedItem.type === "column") && typedItem.content) {
        return {
            ...typedItem,
            content: typedItem.content.map(child => makeItemDockable(child, typedItem.type))
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
    const snapshot: StoredLayoutSnapshot = {
        version: STORAGE_VERSION,
        dockedLayout: serializable,
        floatingPanels: currentFloatingPanels?.serialize() ?? []
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function resetStoredLayout(): void {
    localStorage.removeItem(STORAGE_KEY);
}

export function resetEditorLayout(): void {
    const layout = currentLayout;
    if (!layout) {
        resetStoredLayout();
        return;
    }

    resetStoredLayout();
    currentFloatingPanels?.clearFloatingPanels(true);
    layout.loadLayout(createDefaultLayout());
}

export function initializeEditorLayout(): GoldenLayout {
    installLiveSplitterResize();

    const host = document.getElementById(HOST_ID);
    if (!host || !(host instanceof HTMLElement)) {
        throw new Error(`Layout host "${HOST_ID}" was not found.`);
    }

    const layout = new GoldenLayout(host, bindPanelComponent, unbindPanelComponent);
    currentLayout = layout;
    let saveTimeout: number | undefined;
    currentFloatingPanels = new FloatingPanelManager(layout, host, () => {
        window.clearTimeout(saveTimeout);
        saveTimeout = window.setTimeout(() => {
            saveLayout(layout);
        }, 100);
    });

    layout.addEventListener("stateChanged", () => {
        window.clearTimeout(saveTimeout);
        saveTimeout = window.setTimeout(() => {
            saveLayout(layout);
        }, 100);
    });

    const storedSnapshot = loadStoredLayout();
    const layoutConfig = normalizeLayoutConfig(storedSnapshot?.dockedLayout ?? createDefaultLayout());

    try {
        layout.loadLayout(layoutConfig);
        installAnimatedDropTargetIndicator(layout);
        currentFloatingPanels.restore(storedSnapshot?.floatingPanels ?? []);
    } catch (error) {
        console.warn("Failed to load stored GoldenLayout config, restoring defaults.", error);
        localStorage.removeItem(STORAGE_KEY);
        layout.loadLayout(createDefaultLayout());
        installAnimatedDropTargetIndicator(layout);
    }

    return layout;
}
