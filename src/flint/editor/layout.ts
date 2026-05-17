import { type ComponentContainer, GoldenLayout, LayoutConfig, type ResolvedComponentItemConfig, RowOrColumn } from "golden-layout";
import { CodeEditor } from "./code-editor";
import { FloatingPanelManager, type FloatingPanelState } from "./floating-panels";
import AssetsWindow from "./windows/assets";
import CodeEditorWindow from "./windows/code-editor-window";
import HierarchyWindow from "./windows/hierarchy";
import InspectorWindow from "./windows/inspector";
import ViewportWindow from "./windows/viewport";
import { renderWindowControls } from "./window-controls";
import { activeWindowService, editorAssetStore, editorSelectionService } from "./window-services";
import type { EditorWindow, SpawnWindowOptions, WindowDefinition, WindowManagerApi, WindowType } from "./window-framework";

const STORAGE_KEY = "flint.editor.layout";
const HOST_ID = "layout-host";
const STORAGE_VERSION = 3;
const HEADER_HEIGHT = 20;

let currentLayout: GoldenLayout | null = null;
let currentFloatingPanels: FloatingPanelManager | null = null;
let editorWindowRegistry: EditorWindowRegistry | null = null;
const knownWindowStacks = new Set<LayoutStackItem>();
const windowStacksByInstanceId = new Map<string, LayoutStackItem>();

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

type StoredWindowComponentState = {
    windowType: WindowType;
    instanceId: string;
    windowState?: Record<string, unknown>;
    title?: string;
};

type StoredLayoutSnapshot = {
    version: number;
    dockedLayout: LayoutConfig;
    floatingPanels: FloatingPanelState[];
};

type WindowInstanceRecord = {
    window: EditorWindow;
    container: ComponentContainer;
    type: WindowType;
};

type LayoutComponentItem = {
    componentType?: string;
    parent?: LayoutStackItem;
    container?: ComponentContainer;
    element?: HTMLElement;
};

type LayoutStackItem = {
    isStack?: boolean;
    header?: { controlsContainerElement?: HTMLElement };
    on?: (event: string, callback: () => void) => void;
    getActiveContentItem?: () => LayoutComponentItem | null | undefined;
    __flintWindowControlsBound?: boolean;
};

const windowDefinitions: readonly WindowDefinition[] = [
    { type: "Viewport", title: "Viewport", create: context => new ViewportWindow(context) },
    { type: "CodeEditor", title: "Code Editor", create: context => new CodeEditorWindow(context) },
    { type: "Hierarchy", title: "Hierarchy", create: context => new HierarchyWindow(context) },
    { type: "Assets", title: "Assets", create: context => new AssetsWindow(context) },
    { type: "Inspector", title: "Inspector", create: context => new InspectorWindow(context) }
] as const;

class EditorWindowRegistry implements WindowManagerApi {
    private readonly definitions = new Map<WindowType, WindowDefinition>();
    private readonly instances = new Map<string, WindowInstanceRecord>();
    private instanceCounter = 0;
    private refreshTimeouts = new Map<WindowType | "all", number>();

    public constructor(public readonly layout: GoldenLayout) {
        for (const definition of windowDefinitions) {
            this.definitions.set(definition.type, definition);
        }
    }

    public getWindow(instanceId: string): EditorWindow | undefined {
        return this.instances.get(instanceId)?.window;
    }

    public refreshWindows(type?: WindowType): void {
        const key = type ?? "all";
        if (this.refreshTimeouts.has(key)) {
            return;
        }

        this.refreshTimeouts.set(key, window.setTimeout(() => {
            this.refreshTimeouts.delete(key);
            for (const record of this.instances.values()) {
                if (type && record.type !== type) {
                    continue;
                }
                record.window.update?.();
            }
        }, 500));
    }

    public refreshWindowControls(instanceId: string): void {
        const record = this.instances.get(instanceId);
        if (!record) {
            return;
        }

        const stack = windowStacksByInstanceId.get(instanceId);
        if (stack) {
            syncWindowControlsForStack(stack);
        } else {
            syncWindowControls();
        }
        currentFloatingPanels?.refreshWindowControls(instanceId);
    }

    public createWindow(container: ComponentContainer, itemConfig: ResolvedComponentItemConfig): HTMLElement {
        const state = this.resolveWindowState(itemConfig);
        const definition = this.definitions.get(state.windowType);
        if (!definition) {
            throw new Error(`Unknown window type "${state.windowType}".`);
        }

        const root = document.createElement("div");
        root.dataset.windowType = state.windowType;
        root.dataset.instanceId = state.instanceId;

        const editorWindow = definition.create({
            instanceId: state.instanceId,
            type: state.windowType,
            root,
            container,
            services: {
                selection: editorSelectionService,
                assets: editorAssetStore,
                activeWindows: activeWindowService
            },
            manager: this
        });

        this.instances.set(state.instanceId, {
            window: editorWindow,
            container,
            type: state.windowType
        });

        container.stateRequestEvent = () => ({
            windowType: state.windowType,
            instanceId: state.instanceId,
            windowState: editorWindow.serializeState(),
            title: container.title
        });

        container.element.appendChild(root);
        root.addEventListener("mousedown", () => this.activateWindow(state.instanceId));
        root.addEventListener("focusin", () => this.activateWindow(state.instanceId));

        editorWindow.restoreState(state.windowState);
        void editorWindow.initialize();
        queueMicrotask(() => this.activateWindow(state.instanceId));

        return root;
    }

    public destroyWindow(container: ComponentContainer): void {
        const instanceId = (container.stateRequestEvent?.() as Partial<StoredWindowComponentState> | undefined)?.instanceId
            ?? container.element.firstElementChild?.getAttribute("data-instance-id");
        if (!instanceId) {
            return;
        }

        const record = this.instances.get(instanceId);
        if (!record) {
            return;
        }

        activeWindowService.removeWindow(instanceId);
        windowStacksByInstanceId.delete(instanceId);
        record.window.dispose();
        this.instances.delete(instanceId);
    }

    public activateWindow(instanceId: string): void {
        const record = this.instances.get(instanceId);
        if (!record) {
            return;
        }

        activeWindowService.setActiveWindow(record.type, instanceId);
        record.window.onActivate?.();
    }

    public spawnWindow(type: WindowType, options?: SpawnWindowOptions): string {
        const definition = this.definitions.get(type);
        if (!definition) {
            throw new Error(`Unknown window type "${type}".`);
        }

        const instanceId = this.createInstanceId(type);
        const title = options?.title ?? definition.title;
        const componentState: StoredWindowComponentState = {
            windowType: type,
            instanceId,
            title,
            ...(options?.state !== undefined ? { windowState: options.state } : {})
        };
        const componentConfig = {
            type: "component",
            componentType: type,
            componentState,
            title,
            isClosable: true,
            reorderEnabled: true
        };

        if (currentFloatingPanels) {
            currentFloatingPanels.spawnFloatingComponent(componentConfig);
        } else {
            this.layout.addComponent(type, componentState, title);
        }

        return instanceId;
    }

    public getWindowsOfType<T extends EditorWindow>(type: WindowType): T[] {
        const result: T[] = [];
        for (const record of this.instances.values()) {
            if (record.type === type) {
                result.push(record.window as T);
            }
        }
        return result;
    }

    public getRecordsOfType(type: WindowType): WindowInstanceRecord[] {
        const result: WindowInstanceRecord[] = [];
        for (const record of this.instances.values()) {
            if (record.type === type) {
                result.push(record);
            }
        }
        return result;
    }

    private resolveWindowState(itemConfig: ResolvedComponentItemConfig): StoredWindowComponentState {
        const rawState = itemConfig.componentState as Partial<StoredWindowComponentState> | undefined;
        const windowType = (rawState?.windowType ?? itemConfig.componentType) as WindowType;
        const instanceId = typeof rawState?.instanceId === "string"
            ? rawState.instanceId
            : this.createInstanceId(windowType);

        const windowStateValue = rawState?.windowState;
        return {
            windowType,
            instanceId,
            ...(windowStateValue !== undefined ? { windowState: windowStateValue } : {}),
            title: typeof rawState?.title === "string" ? rawState.title : itemConfig.title
        };
    }

    private createInstanceId(type: WindowType): string {
        this.instanceCounter += 1;
        return `flint-${type.toLowerCase()}-${this.instanceCounter}`;
    }
}

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
        if (this._splitterPosition === null || this._liveResizeBeforeSize === undefined || this._liveResizeAfterSize === undefined) {
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
        if (this._splitterPosition !== null && this._liveResizeBeforeSize !== undefined && this._liveResizeAfterSize !== undefined) {
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

function getInstanceIdFromContainer(container: ComponentContainer | undefined): string | null {
    const state = container?.stateRequestEvent?.() as Partial<StoredWindowComponentState> | undefined;
    if (typeof state?.instanceId === "string") {
        return state.instanceId;
    }

    const root = container?.element.firstElementChild;
    return root instanceof HTMLElement ? root.dataset.instanceId ?? null : null;
}

function getInstanceIdFromItem(item: LayoutComponentItem | null | undefined): string | null {
    const containerInstanceId = getInstanceIdFromContainer(item?.container);
    if (containerInstanceId) {
        return containerInstanceId;
    }

    const root = item?.element?.querySelector<HTMLElement>("[data-instance-id]");
    return root?.dataset.instanceId ?? null;
}

function getWindowFromItem(item: LayoutComponentItem | null | undefined): EditorWindow | null {
    const instanceId = getInstanceIdFromItem(item);
    if (!instanceId || !editorWindowRegistry) {
        return null;
    }

    return editorWindowRegistry.getWindow(instanceId) ?? null;
}

function getWindowControlsFromItem(item: LayoutComponentItem | null | undefined) {
    return getWindowFromItem(item)?.getControls?.() ?? [];
}

function syncWindowControlsForStack(stack: LayoutStackItem | undefined): void {
    if (!stack?.isStack) {
        return;
    }

    knownWindowStacks.add(stack);

    const controlsHost = stack.header?.controlsContainerElement;
    if (!controlsHost) {
        return;
    }

    if (!stack.__flintWindowControlsBound) {
        stack.on?.("activeContentItemChanged", () => syncWindowControlsForStack(stack));
        stack.__flintWindowControlsBound = true;
    }

    const activeItem = stack.getActiveContentItem?.();
    const activeInstanceId = getInstanceIdFromItem(activeItem);
    if (activeInstanceId) {
        windowStacksByInstanceId.set(activeInstanceId, stack);
    }

    renderWindowControls(controlsHost, getWindowControlsFromItem(activeItem), {
        placement: "prepend",
        extraClassName: "lm_controls_button"
    });
}

function syncWindowControls(): void {
    if (!editorWindowRegistry) {
        return;
    }

    const stacks = new Set<LayoutStackItem>();
    for (const type of ["Viewport", "CodeEditor", "Hierarchy", "Assets", "Inspector"] as const) {
        for (const record of editorWindowRegistry.getRecordsOfType(type)) {
            const stack = (record.container as ComponentContainer & { parent?: LayoutStackItem }).parent;
            if (stack) {
                stacks.add(stack);
            }
        }
    }
    for (const stack of knownWindowStacks) {
        stacks.add(stack);
    }

    for (const stack of stacks) {
        syncWindowControlsForStack(stack);
    }
}

function createPanelStack(type: WindowType, title: string, size: string) {
    return {
        type: "stack" as const,
        size,
        isClosable: true,
        content: [
            {
                type: "component" as const,
                componentType: type,
                componentState: {
                    windowType: type
                },
                title,
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
                componentState: { windowType: "Viewport" },
                title: "Viewport",
                isClosable: true,
                reorderEnabled: true
            },
            {
                type: "component" as const,
                componentType: "CodeEditor",
                componentState: { windowType: "CodeEditor" },
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

function bindPanelComponent(container: ComponentContainer, itemConfig: ResolvedComponentItemConfig) {
    if (!editorWindowRegistry) {
        throw new Error("Editor window registry is not initialized.");
    }

    const root = editorWindowRegistry.createWindow(container, itemConfig);
    return {
        component: {
            rootHtmlElement: root
        },
        virtual: false
    };
}

function unbindPanelComponent(container: ComponentContainer) {
    editorWindowRegistry?.destroyWindow(container);
    const panelRoot = container.element.firstElementChild;
    if (panelRoot instanceof HTMLElement) {
        panelRoot.remove();
    }
}

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
        componentType?: WindowType;
        componentState?: Record<string, unknown>;
        isClosable?: boolean;
        header?: Record<string, unknown>;
    };

    if (typedItem.type === "component" && parentType !== "stack") {
        return {
            type: "stack" as const,
            isClosable: true,
            content: [typedItem]
        };
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
    editorWindowRegistry = new EditorWindowRegistry(layout);
    CodeEditor.setWindowSpawner(type => editorWindowRegistry!.spawnWindow(type));

    let saveTimeout: number | undefined;
    currentFloatingPanels = new FloatingPanelManager(layout, host, () => {
        window.clearTimeout(saveTimeout);
        saveTimeout = window.setTimeout(() => saveLayout(layout), 100);
    }, componentItem => getWindowControlsFromItem(componentItem as LayoutComponentItem));

    (layout as unknown as { on: (event: string, callback: (item: unknown) => void) => void }).on("itemCreated", (event: unknown) => {
        const item = (event as { _target?: unknown })._target as LayoutComponentItem | undefined;
        syncWindowControlsForStack(item?.parent);
    });

    layout.addEventListener("stateChanged", () => {
        window.clearTimeout(saveTimeout);
        saveTimeout = window.setTimeout(() => saveLayout(layout), 100);
        syncWindowControls();
    });

    const storedSnapshot = loadStoredLayout();
    const layoutConfig = normalizeLayoutConfig(storedSnapshot?.dockedLayout ?? createDefaultLayout());

    try {
        layout.loadLayout(layoutConfig);
        installAnimatedDropTargetIndicator(layout);
        currentFloatingPanels.restore(storedSnapshot?.floatingPanels ?? []);
        syncWindowControls();
    } catch (error) {
        console.warn("Failed to load stored GoldenLayout config, restoring defaults.", error);
        localStorage.removeItem(STORAGE_KEY);
        layout.loadLayout(createDefaultLayout());
        installAnimatedDropTargetIndicator(layout);
        syncWindowControls();
    }

    return layout;
}

export function spawnEditorWindow(type: WindowType, options?: SpawnWindowOptions): string {
    if (!editorWindowRegistry) {
        throw new Error("Editor window registry is not initialized.");
    }

    return editorWindowRegistry.spawnWindow(type, options);
}

export function refreshEditorWindows(type?: WindowType): void {
    editorWindowRegistry?.refreshWindows(type);
}

export function getEditorWindowsOfType<T extends EditorWindow>(type: WindowType): T[] {
    return editorWindowRegistry?.getWindowsOfType<T>(type) ?? [];
}
