import type { ComponentContainer, ComponentItem, ComponentItemConfig, ContentItem, GoldenLayout, Stack, Tab } from "golden-layout";
import { renderWindowControls } from "./window-controls";
import type { EditorWindowControl } from "./window-framework";

const FLOATING_OVERLAY_ID = "layout-floating-host";
const FLOATING_STACK_ID_PREFIX = "flint-floating-stack-";
const DEFAULT_FLOAT_WIDTH = 420;
const DEFAULT_FLOAT_HEIGHT = 280;
const MIN_VISIBLE_MARGIN = 24;
const DRAGGING_CLASS = "flint-floating-window-dragging";
const DOCK_GUIDE_CLASS = "flint-dock-guide";
const OUTER_DOCK_GUIDE_CLASS = "flint-dock-guide-outer";
const DOCK_GUIDE_VISIBLE_CLASS = "visible";
const DOCK_GUIDE_ACTIVE_CLASS = "active";
const RESIZE_DIRECTIONS = [
    "n",
    "e",
    "s",
    "w",
    "ne",
    "nw",
    "se",
    "sw"
] as const;
const DOCK_ZONES = ["top", "left", "center", "right", "bottom"] as const;
const OUTER_DOCK_ZONES = ["top", "left", "right", "bottom"] as const;

type ResizeDirection = typeof RESIZE_DIRECTIONS[number];
type DockZone = typeof DOCK_ZONES[number];
type OuterDockZone = typeof OUTER_DOCK_ZONES[number];

type Bounds = {
    x: number;
    y: number;
    width: number;
    height: number;
};

type FloatingDockTarget = {
    stackId: string | null;
    index: number;
};

export type FloatingPanelState = {
    componentId: string;
    componentConfig: Record<string, unknown>;
    bounds: Bounds;
    zIndex: number;
    dockTarget: FloatingDockTarget | null;
};

type DockArea = {
    x1?: number;
    y1?: number;
    x2?: number;
    y2?: number;
    surface?: number;
    contentItem: InternalContentItem;
};

type InternalComponentItem = ComponentItem & {
    container?: ComponentContainer;
    enterDragMode: (width: number, height: number) => void;
    exitDragMode: () => void;
    drag: () => void;
    show: () => void;
    destroy: () => void;
};

type InternalContentItem = ContentItem & {
    updateSize: (force: boolean) => void;
    onDrop: (contentItem: ContentItem, area: DockArea) => void;
    highlightDropZone: (x: number, y: number, area: DockArea) => void;
    addChild: (contentItem: ContentItem, index?: number, suspendResize?: boolean) => number;
    replaceChild: (oldChild: ContentItem, newChild: ContentItem, destroyOldChild?: boolean) => void;
    size: number;
    sizeUnit: string;
};

type InternalStack = Stack & InternalContentItem & {
    addChild: (contentItem: ContentItem, index?: number, focus?: boolean) => number;
    getArea: () => DockArea | null;
    childElementContainer: HTMLElement;
    contentAreaDimensions?: Partial<Record<DockZone | "header" | "body", { highlightArea: DockArea }>>;
    header: {
        element: HTMLElement;
    };
    _dropSegment?: "header" | "body" | "left" | "right" | "top" | "bottom";
    destroy: () => void;
};

type InternalLayout = GoldenLayout & {
    createAndInitContentItem: (config: unknown, parent: ContentItem) => ContentItem;
    calculateItemAreas: () => void;
    getArea: (x: number, y: number) => DockArea | null;
    groundItem?: ContentItem;
    dropTargetIndicator: {
        hide: () => void;
        highlightArea: (area: DockArea, level: number) => void;
    } | null;
    tabDropPlaceholder: HTMLElement;
    emit: (eventName: string, ...args: unknown[]) => void;
};

interface InternalDragListener {
    on(eventName: "drag", callback: (offsetX: number, offsetY: number, event: PointerEvent) => void): void;
    on(eventName: "dragStop", callback: (event?: PointerEvent) => void): void;
    off(eventName: "drag", callback: (offsetX: number, offsetY: number, event: PointerEvent) => void): void;
    off(eventName: "dragStop", callback: (event?: PointerEvent) => void): void;
}

type InternalTab = Tab & {
    _dragStartEvent?: (x: number, y: number, dragListener: InternalDragListener, componentItem: ComponentItem) => void;
};

type FloatingPanel = {
    componentId: string;
    componentItem: InternalComponentItem;
    floatingStack: InternalStack;
    shell: HTMLElement;
    title: HTMLElement;
    actions: HTMLElement;
    body: HTMLElement;
    handleTitleChanged: (updatedTitle: string) => void;
    bounds: Bounds;
    zIndex: number;
    dockTarget: FloatingDockTarget | null;
};

type FloatOptions = {
    bounds?: Bounds;
    dockTarget?: FloatingDockTarget | null;
    zIndex?: number;
};

type DockPreview =
    | {
        kind: "header";
        stack: InternalStack;
        area: DockArea;
        pointerX: number;
        pointerY: number;
    }
    | {
        kind: "zone";
        stack: InternalStack;
        area: DockArea;
        zone: DockZone;
    }
    | {
        kind: "outer-zone";
        targetItem: InternalContentItem;
        zone: OuterDockZone;
        area: DockArea;
    };

type ResolvedHeaderConfig = {
    show?: false | string;
    popout?: false | string;
    maximise?: false | string;
    close?: string;
    minimise?: string;
    tabDropdown?: false | string;
};

type ResolvedComponentConfig = {
    type: "component";
    title: string;
    componentType: unknown;
    componentState?: unknown;
    id: string;
    maximised: boolean;
    isClosable: boolean;
    reorderEnabled: boolean;
    header?: ResolvedHeaderConfig;
    size: number;
    sizeUnit: string;
    minSize?: number;
    minSizeUnit: string;
};

function ensureComponentId(componentItem: ComponentItem): string {
    if (componentItem.id) {
        return componentItem.id;
    }

    const fallbackId = `flint-panel-${String(componentItem.componentType).toLowerCase()}-${Date.now()}`;
    componentItem.id = fallbackId;
    return fallbackId;
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}

function resolveDockGuideZone(guideRect: DOMRect, clientX: number, clientY: number): DockZone | null {
    if (!isPointerInsideRect(clientX, clientY, guideRect)) {
        return null;
    }

    const relativeX = guideRect.width > 0 ? (clientX - guideRect.left) / guideRect.width : 0.5;
    const relativeY = guideRect.height > 0 ? (clientY - guideRect.top) / guideRect.height : 0.5;
    const inset = 0.32;

    if (relativeY <= inset && relativeX >= inset && relativeX <= 1 - inset) {
        return "top";
    }

    if (relativeY >= 1 - inset && relativeX >= inset && relativeX <= 1 - inset) {
        return "bottom";
    }

    if (relativeX <= inset && relativeY >= inset && relativeY <= 1 - inset) {
        return "left";
    }

    if (relativeX >= 1 - inset && relativeY >= inset && relativeY <= 1 - inset) {
        return "right";
    }

    return "center";
}

function parsePixels(value: string | number | undefined, fallback: number): number {
    if (typeof value === "number") {
        return value;
    }

    const parsed = Number.parseFloat(value ?? "");
    return Number.isFinite(parsed) ? parsed : fallback;
}

function isPointerInsideRect(x: number, y: number, rect: DOMRect): boolean {
    return x >= rect.left && x <= rect.right && y >= rect.top && y <= rect.bottom;
}

function formatSize(size: number | undefined, unit: string): string | undefined {
    if (size === undefined) {
        return undefined;
    }

    return `${size}${unit}`;
}

function toSerializableComponentConfig(componentItem: InternalComponentItem): Record<string, unknown> {
    const resolved = componentItem.toConfig() as unknown as ResolvedComponentConfig;
    const result: Record<string, unknown> = {
        type: "component",
        title: resolved.title,
        componentType: resolved.componentType,
        id: resolved.id,
        isClosable: resolved.isClosable,
        reorderEnabled: resolved.reorderEnabled,
        maximised: resolved.maximised,
        size: formatSize(resolved.size, resolved.sizeUnit)
    };

    const minSize = formatSize(resolved.minSize, resolved.minSizeUnit);
    if (minSize !== undefined) {
        result.minSize = minSize;
    }

    if (resolved.componentState !== undefined) {
        result.componentState = resolved.componentState;
    }

    if (resolved.header !== undefined) {
        result.header = { ...resolved.header };
    }

    return result;
}

function createFloatingStackConfig(stackId: string): Record<string, unknown> {
    return {
        type: "stack",
        content: [],
        size: 1,
        sizeUnit: "fr",
        minSize: undefined,
        minSizeUnit: "px",
        id: stackId,
        maximised: false,
        isClosable: false,
        activeItemIndex: 0,
        header: {
            show: false,
            popout: false,
            close: undefined,
            maximise: undefined,
            minimise: undefined,
            tabDropdown: false
        }
    };
}

class TabTearOffDragProxy {
    private readonly dragCallback = (_offsetX: number, _offsetY: number, event: PointerEvent) => this.onDrag(event);
    private readonly dragStopCallback = (event?: PointerEvent) => this.onDrop(event);
    private readonly componentFocused: boolean;
    private readonly panel: FloatingPanel;
    private readonly startBounds: Bounds;
    private readonly startPageX: number;
    private readonly startPageY: number;
    private lastPointerX: number;
    private lastPointerY: number;

    public constructor(
        private readonly manager: FloatingPanelManager,
        private readonly x: number,
        private readonly y: number,
        private readonly dragListener: InternalDragListener,
        private readonly componentItem: InternalComponentItem,
        originalParent: Stack
    ) {
        const dockTarget = manager.captureDockTarget(componentItem, originalParent);
        this.lastPointerX = x;
        this.lastPointerY = y;

        this.componentFocused = componentItem.focused;
        if (this.componentFocused) {
            componentItem.blur();
        }

        if (!componentItem.parent) {
            throw new Error("Dragged component is missing a parent stack.");
        }

        const sourceRect = componentItem.element.getBoundingClientRect();
        componentItem.parent.removeChild(componentItem, true);
        this.panel = this.manager.attachDetachedComponent(this.componentItem, {
            bounds: this.manager.boundsFromViewportRect(sourceRect, x, y),
            dockTarget
        });
        this.startBounds = { ...this.panel.bounds };
        this.startPageX = x;
        this.startPageY = y;
        this.panel.shell.classList.add(DRAGGING_CLASS);

        this.manager.updateDockPreview(x, y);

        this.dragListener.on("drag", this.dragCallback);
        this.dragListener.on("dragStop", this.dragStopCallback);
    }

    private onDrag(event: PointerEvent): void {
        this.lastPointerX = event.pageX;
        this.lastPointerY = event.pageY;
        this.manager.moveFloatingPanel(this.panel, {
            x: this.startBounds.x + (event.pageX - this.startPageX),
            y: this.startBounds.y + (event.pageY - this.startPageY),
            width: this.startBounds.width,
            height: this.startBounds.height
        });
        this.manager.updateDockPreview(event.pageX, event.pageY);
    }

    private onDrop(event?: PointerEvent): void {
        this.dragListener.off("drag", this.dragCallback);
        this.dragListener.off("dragStop", this.dragStopCallback);
        this.panel.shell.classList.remove(DRAGGING_CLASS);

        const finalX = event?.pageX ?? this.lastPointerX;
        const finalY = event?.pageY ?? this.lastPointerY;
        this.manager.updateDockPreview(finalX, finalY);

        let redocked = false;
        if (this.manager.hasActiveDockPreview()) {
            this.manager.dockPanel(this.panel, true);
            redocked = true;
        } else {
            this.manager.clearDockPreview();
            this.manager.persistFloatingPanel(this.panel);
        }

        if (redocked && this.componentFocused) {
            this.componentItem.focus();
        }
    }
}

export class FloatingPanelManager {
    private readonly internalLayout: InternalLayout;
    private readonly overlay: HTMLElement;
    private readonly guideOverlay: HTMLElement;
    private readonly dockGuide: HTMLElement;
    private readonly dockGuideIcons = new Map<DockZone, HTMLElement>();
    private readonly outerDockGuideIcons = new Map<OuterDockZone, HTMLElement>();
    private readonly panels = new Map<string, FloatingPanel>();
    private activeDockPreview: DockPreview | null = null;
    private dockGuideStack: InternalStack | null = null;
    private nextZIndex = 0;

    public constructor(
        private readonly layout: GoldenLayout,
        private readonly host: HTMLElement,
        private readonly onChanged: () => void,
        private readonly getWindowControls: (componentItem: ComponentItem) => readonly EditorWindowControl[] = () => []
    ) {
        this.internalLayout = layout as InternalLayout;
        this.overlay = this.createOverlay();
        this.guideOverlay = this.createGuideOverlay();
        this.dockGuide = this.createDockGuide();
        this.createOuterDockGuides();
        this.layout.addEventListener("tabCreated", tab => this.decorateTab(tab));
    }

    public destroy(): void {
        this.clearDockPreview();
        this.clearFloatingPanels(true);
        this.guideOverlay.remove();
        this.overlay.remove();
    }

    public updateDockPreview(pageX: number, pageY: number): DockPreview | null {
        const clientX = pageX - window.scrollX;
        const clientY = pageY - window.scrollY;
        let hoveredStack = this.findHoveredStack(this.layout.rootItem, pageX, pageY);
        if (!hoveredStack && this.dockGuideStack && this.getOuterDockGuideZone(clientX, clientY)) {
            hoveredStack = this.dockGuideStack;
        }

        if (!hoveredStack) {
            this.clearDockPreview();
            return null;
        }

        this.dockGuideStack = hoveredStack;

        const stackArea = hoveredStack.getArea();
        if (!stackArea) {
            this.clearDockPreview();
            return null;
        }

        const headerRect = hoveredStack.header.element.getBoundingClientRect();
        if (isPointerInsideRect(clientX, clientY, headerRect)) {
            this.hideDockGuide();
            hoveredStack.highlightDropZone(pageX, pageY, stackArea);
            this.activeDockPreview = {
                kind: "header",
                stack: hoveredStack,
                area: stackArea,
                pointerX: pageX,
                pointerY: pageY
            };
            return this.activeDockPreview;
        }

        const contentRect = hoveredStack.childElementContainer.getBoundingClientRect();
        this.showDockGuide(contentRect);
        this.showOuterDockGuides(hoveredStack, contentRect);
        const outerZone = this.getOuterDockGuideZone(clientX, clientY);
        this.setActiveOuterDockGuideZone(outerZone);
        if (outerZone) {
            this.setActiveDockGuideZone(null);
            const outerTarget = this.findOuterDockTargetItem(hoveredStack, outerZone);
            if (!outerTarget) {
                this.clearDockPreview();
                return null;
            }

            const highlightArea = this.createOuterZoneHighlightArea(outerTarget, outerZone);
            this.internalLayout.dropTargetIndicator?.highlightArea(highlightArea, 1);
            this.internalLayout.tabDropPlaceholder.remove();
            this.activeDockPreview = {
                kind: "outer-zone",
                targetItem: outerTarget,
                zone: outerZone,
                area: highlightArea
            };
            return this.activeDockPreview;
        }

        if (!isPointerInsideRect(clientX, clientY, contentRect)) {
            this.clearDockPreview();
            return null;
        }

        const activeZone = this.getDockGuideZone(clientX, clientY);
        this.setActiveDockGuideZone(activeZone);
        if (!activeZone) {
            this.internalLayout.dropTargetIndicator?.hide();
            this.internalLayout.tabDropPlaceholder.remove();
            this.activeDockPreview = null;
            return null;
        }

        const highlightArea = this.createZoneHighlightArea(hoveredStack, contentRect, activeZone);
        this.internalLayout.dropTargetIndicator?.highlightArea(highlightArea, 1);
        this.internalLayout.tabDropPlaceholder.remove();

        this.activeDockPreview = {
            kind: "zone",
            stack: hoveredStack,
            area: stackArea,
            zone: activeZone
        };
        return this.activeDockPreview;
    }

    public applyDockPreview(componentItem: InternalComponentItem): boolean {
        const preview = this.activeDockPreview;
        if (!preview) {
            return false;
        }

        if (preview.kind === "header") {
            preview.stack.highlightDropZone(preview.pointerX, preview.pointerY, preview.area);
            preview.stack.onDrop(componentItem, preview.area);
        } else if (preview.kind === "outer-zone") {
            this.applyOuterDockPreview(componentItem, preview.targetItem, preview.zone);
        } else if (preview.zone === "center") {
            preview.stack.addChild(componentItem, undefined, true);
        } else {
            preview.stack._dropSegment = preview.zone;
            preview.stack.onDrop(componentItem, preview.area);
        }

        this.clearDockPreview();
        return true;
    }

    public clearDockPreview(): void {
        this.activeDockPreview = null;
        this.dockGuideStack = null;
        this.hideDockGuide();
        this.internalLayout.dropTargetIndicator?.hide();
        this.internalLayout.tabDropPlaceholder.remove();
    }

    public clearFloatingPanels(destroyItems: boolean): void {
        const panels = [...this.panels.values()];
        this.clearDockPreview();
        this.panels.clear();

        for (const panel of panels) {
            panel.shell.remove();
            panel.componentItem.off("titleChanged", panel.handleTitleChanged);

            if (destroyItems) {
                panel.floatingStack.destroy();
            }
        }
    }

    public refreshWindowControls(instanceId: string): void {
        for (const panel of this.panels.values()) {
            if (this.getPanelInstanceId(panel) === instanceId) {
                this.renderPanelControls(panel);
            }
        }
    }

    public decorateTab(tab: Tab): void {
        const internalTab = tab as InternalTab;
        const tabElement = tab.element;
        if (tabElement.querySelector(".flint-tab-undock")) {
            return;
        }

        const button = document.createElement("button");
        button.type = "button";
        button.className = "flint-tab-undock";
        button.setAttribute("aria-label", "Float panel");
        button.title = "Float panel";
        const undockIcon = document.createElement("sl-icon");
        undockIcon.setAttribute("name", "box-arrow-up-right");
        undockIcon.setAttribute("aria-hidden", "true");
        button.appendChild(undockIcon);
        button.addEventListener("pointerdown", event => {
            event.preventDefault();
            event.stopPropagation();
        });
        button.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            this.floatComponent(tab.componentItem);
        });
        tabElement.appendChild(button);

        internalTab._dragStartEvent = (x, y, dragListener, componentItem) => {
            const parent = componentItem.parent;
            if (!parent || !parent.isStack) {
                return;
            }

            if (parent.isStack && (parent as Stack).isMaximised) {
                (parent as Stack).toggleMaximise();
            }

            new TabTearOffDragProxy(
                this,
                x,
                y,
                dragListener,
                componentItem as InternalComponentItem,
                parent as Stack
            );
        };
    }

    public boundsFromViewportRect(rect: DOMRect, pointerPageX?: number, pointerPageY?: number): Bounds {
        const hostRect = this.host.getBoundingClientRect();
        const bounds = this.clampBounds({
            x: rect.left - hostRect.left,
            y: rect.top - hostRect.top,
            width: rect.width,
            height: rect.height
        });

        if (pointerPageX === undefined || pointerPageY === undefined) {
            return bounds;
        }

        const pointerClientX = pointerPageX - window.scrollX;
        const pointerClientY = pointerPageY - window.scrollY;
        const relativeX = rect.width > 0 ? clamp((pointerClientX - rect.left) / rect.width, 0, 1) : 0.5;
        const relativeY = rect.height > 0 ? clamp((pointerClientY - rect.top) / rect.height, 0, 1) : 0.5;
        return this.clampBounds({
            x: pointerClientX - hostRect.left - bounds.width * relativeX,
            y: pointerClientY - hostRect.top - bounds.height * relativeY,
            width: bounds.width,
            height: bounds.height
        });
    }

    public captureDockTarget(componentItem: ComponentItem, fallbackParent?: Stack): FloatingDockTarget | null {
        const parent = (componentItem.parent as Stack | null) ?? fallbackParent ?? null;
        if (!parent) {
            return null;
        }

        return {
            stackId: parent.id || null,
            index: Math.max(0, parent.contentItems.indexOf(componentItem))
        };
    }

    public serialize(): FloatingPanelState[] {
        return [...this.panels.values()]
            .sort((left, right) => left.zIndex - right.zIndex)
            .map(panel => ({
                componentId: panel.componentId,
                componentConfig: toSerializableComponentConfig(panel.componentItem),
                bounds: { ...panel.bounds },
                zIndex: panel.zIndex,
                dockTarget: panel.dockTarget ? { ...panel.dockTarget } : null
            }));
    }

    public restore(states: readonly FloatingPanelState[]): void {
        const orderedStates = [...states].sort((left, right) => left.zIndex - right.zIndex);
        for (const state of orderedStates) {
            const created = this.layout.newItem(state.componentConfig as ComponentItemConfig) as InternalComponentItem;
            this.floatComponent(created, {
                bounds: state.bounds,
                dockTarget: state.dockTarget,
                zIndex: state.zIndex
            });
        }
    }

    public spawnFloatingComponent(componentConfig: Record<string, unknown>, options: FloatOptions = {}): void {
        const created = this.layout.newItem(componentConfig as ComponentItemConfig) as InternalComponentItem;
        this.floatComponent(created, {
            ...options,
            bounds: options.bounds ?? this.createResetBounds()
        });
    }

    public floatComponent(componentItem: ComponentItem, options: FloatOptions = {}): void {
        const internalComponentItem = componentItem as InternalComponentItem;
        const componentId = ensureComponentId(componentItem);
        if (this.panels.has(componentId)) {
            const existingPanel = this.panels.get(componentId)!;
            this.focusPanel(existingPanel);
            return;
        }

        const parent = internalComponentItem.parent;
        const dockTarget = options.dockTarget ?? this.captureDockTarget(componentItem);
        const sourceRect = componentItem.element.getBoundingClientRect();

        if (!parent) {
            throw new Error("Cannot float a component without a parent.");
        }

        parent.removeChild(componentItem, true);

        const floatOptions: FloatOptions = {
            bounds: options.bounds ?? this.createDefaultBounds(sourceRect),
            dockTarget
        };
        if (options.zIndex !== undefined) {
            floatOptions.zIndex = options.zIndex;
        }

        this.attachDetachedComponent(internalComponentItem, floatOptions);
    }

    public attachDetachedComponent(componentItem: InternalComponentItem, options: FloatOptions = {}): FloatingPanel {
        const componentId = ensureComponentId(componentItem);
        if (this.panels.has(componentId)) {
            return this.panels.get(componentId)!;
        }

        const floatingStack = this.createFloatingStack(componentItem);
        const panel = this.createPanel(componentId, componentItem, floatingStack, options);
        this.panels.set(componentId, panel);
        this.overlay.appendChild(panel.shell);
        this.focusPanel(panel);
        this.updatePanelBounds(panel, panel.bounds, false);
        this.syncFloatingStack(panel);
        this.onChanged();
        return panel;
    }

    private createOverlay(): HTMLElement {
        const overlay = document.createElement("div");
        overlay.id = FLOATING_OVERLAY_ID;
        this.host.appendChild(overlay);
        return overlay;
    }

    private createGuideOverlay(): HTMLElement {
        const overlay = document.createElement("div");
        overlay.className = "flint-dock-overlay";
        this.host.parentElement?.appendChild(overlay);
        return overlay;
    }

    private createDockGuide(): HTMLElement {
        const guide = document.createElement("div");
        guide.className = DOCK_GUIDE_CLASS;

        for (const zone of DOCK_ZONES) {
            const icon = document.createElement("div");
            icon.className = `flint-dock-zone flint-dock-zone-${zone}`;
            guide.appendChild(icon);
            this.dockGuideIcons.set(zone, icon);
        }

        this.guideOverlay.appendChild(guide);
        return guide;
    }

    private createOuterDockGuides(): void {
        for (const zone of OUTER_DOCK_ZONES) {
            const icon = document.createElement("div");
            icon.className = `${DOCK_GUIDE_CLASS} ${OUTER_DOCK_GUIDE_CLASS} flint-dock-zone flint-dock-zone-${zone}`;
            this.guideOverlay.appendChild(icon);
            this.outerDockGuideIcons.set(zone, icon);
        }
    }

    private showDockGuide(contentRect: DOMRect): void {
        const guideSize = Math.min(156, Math.max(112, Math.min(contentRect.width, contentRect.height) * 0.52));
        this.dockGuide.classList.add(DOCK_GUIDE_VISIBLE_CLASS);
        this.dockGuide.style.width = `${guideSize}px`;
        this.dockGuide.style.height = `${guideSize}px`;
        this.dockGuide.style.left = `${contentRect.left - this.host.getBoundingClientRect().left + (contentRect.width - guideSize) / 2}px`;
        this.dockGuide.style.top = `${contentRect.top - this.host.getBoundingClientRect().top + (contentRect.height - guideSize) / 2}px`;
    }

    private hideDockGuide(): void {
        this.dockGuide.classList.remove(DOCK_GUIDE_VISIBLE_CLASS);
        this.setActiveDockGuideZone(null);
        this.hideOuterDockGuides();
    }

    private setActiveDockGuideZone(zone: DockZone | null): void {
        for (const [currentZone, element] of this.dockGuideIcons.entries()) {
            element.classList.toggle(DOCK_GUIDE_ACTIVE_CLASS, currentZone === zone);
        }
    }

    private setActiveOuterDockGuideZone(zone: OuterDockZone | null): void {
        for (const [currentZone, element] of this.outerDockGuideIcons.entries()) {
            element.classList.toggle(DOCK_GUIDE_ACTIVE_CLASS, currentZone === zone);
        }
    }

    private getDockGuideZone(clientX: number, clientY: number): DockZone | null {
        const guideRect = this.dockGuide.getBoundingClientRect();
        const guideZone = resolveDockGuideZone(guideRect, clientX, clientY);
        if (guideZone) {
            return guideZone;
        }

        for (const zone of DOCK_ZONES) {
            const element = this.dockGuideIcons.get(zone);
            if (!element) {
                continue;
            }

            if (isPointerInsideRect(clientX, clientY, element.getBoundingClientRect())) {
                return zone;
            }
        }

        return null;
    }

    private getOuterDockGuideZone(clientX: number, clientY: number): OuterDockZone | null {
        for (const zone of OUTER_DOCK_ZONES) {
            const element = this.outerDockGuideIcons.get(zone);
            if (!element || !element.classList.contains(DOCK_GUIDE_VISIBLE_CLASS)) {
                continue;
            }

            const rect = element.getBoundingClientRect();
            if (isPointerInsideRect(clientX, clientY, rect)) {
                return zone;
            }
        }

        return null;
    }

    private showOuterDockGuides(stack: InternalStack, anchorRect: DOMRect): void {
        const hostRect = this.host.getBoundingClientRect();
        const guideSize = 54;
        const inset = 10;

        for (const zone of OUTER_DOCK_ZONES) {
            const icon = this.outerDockGuideIcons.get(zone);
            const targetItem = this.findOuterDockTargetItem(stack, zone);
            if (!icon) {
                continue;
            }

            if (!targetItem) {
                icon.classList.remove(DOCK_GUIDE_VISIBLE_CLASS);
                continue;
            }

            let left = anchorRect.left - hostRect.left;
            let top = anchorRect.top - hostRect.top;

            if (zone === "left") {
                left += inset;
                top += (anchorRect.height - guideSize) / 2;
            } else if (zone === "right") {
                left += anchorRect.width - guideSize - inset;
                top += (anchorRect.height - guideSize) / 2;
            } else if (zone === "top") {
                left += (anchorRect.width - guideSize) / 2;
                top += inset;
            } else {
                left += (anchorRect.width - guideSize) / 2;
                top += anchorRect.height - guideSize - inset;
            }

            icon.style.width = `${guideSize}px`;
            icon.style.height = `${guideSize}px`;
            icon.style.left = `${left}px`;
            icon.style.top = `${top}px`;
            icon.classList.add(DOCK_GUIDE_VISIBLE_CLASS);
        }
    }

    private hideOuterDockGuides(): void {
        this.setActiveOuterDockGuideZone(null);
        for (const element of this.outerDockGuideIcons.values()) {
            element.classList.remove(DOCK_GUIDE_VISIBLE_CLASS);
        }
    }

    private createFloatingStack(componentItem: InternalComponentItem): InternalStack {
        const parent = this.internalLayout.groundItem ?? this.layout.rootItem;
        if (!parent) {
            throw new Error("GoldenLayout root is unavailable for floating stack creation.");
        }

        const stackConfig = createFloatingStackConfig(`${FLOATING_STACK_ID_PREFIX}${ensureComponentId(componentItem)}`);
        const floatingStack = this.internalLayout.createAndInitContentItem(stackConfig, parent) as InternalStack;
        floatingStack.addChild(componentItem, 0, true);
        floatingStack.element.classList.add("flint-floating-stack");
        return floatingStack;
    }

    private createPanel(
        componentId: string,
        componentItem: InternalComponentItem,
        floatingStack: InternalStack,
        options: FloatOptions
    ): FloatingPanel {
        const shell = document.createElement("section");
        shell.className = "flint-floating-window";
        shell.dataset.panelId = componentId;

        const header = document.createElement("header");
        header.className = "flint-floating-window-header";

        const title = document.createElement("div");
        title.className = "flint-floating-window-title";
        title.textContent = componentItem.title;

        const actions = document.createElement("div");
        actions.className = "flint-floating-window-actions";

        const windowControls = document.createElement("div");
        windowControls.className = "flint-floating-window-controls";
        actions.appendChild(windowControls);

        const dockButton = document.createElement("button");
        dockButton.type = "button";
        dockButton.className = "flint-floating-window-button flint-floating-window-dock";
        dockButton.title = "Dock panel";
        dockButton.setAttribute("aria-label", "Dock panel");
        const dockIcon = document.createElement("sl-icon");
        dockIcon.setAttribute("name", "box-arrow-in-down-right");
        dockIcon.setAttribute("aria-hidden", "true");
        dockButton.appendChild(dockIcon);
        dockButton.addEventListener("click", event => {
            event.preventDefault();
            event.stopPropagation();
            const panel = this.panels.get(componentId);
            if (panel) {
                this.dockPanel(panel);
            }
        });

        actions.appendChild(dockButton);
        header.appendChild(title);
        header.appendChild(actions);

        const body = document.createElement("div");
        body.className = "flint-floating-window-body";
        body.appendChild(floatingStack.element);

        shell.appendChild(header);
        shell.appendChild(body);
        for (const direction of RESIZE_DIRECTIONS) {
            const handle = document.createElement("div");
            handle.className = `flint-floating-resize-handle flint-floating-resize-${direction}`;
            handle.addEventListener("pointerdown", event => this.beginResize(event, componentId, direction));
            shell.appendChild(handle);
        }

        shell.addEventListener("pointerdown", () => {
            const panel = this.panels.get(componentId);
            if (panel) {
                this.focusPanel(panel);
            }
        });
        header.addEventListener("pointerdown", event => this.beginMove(event, componentId));
        const handleTitleChanged = (updatedTitle: string) => {
            title.textContent = updatedTitle;
        };
        componentItem.on("titleChanged", handleTitleChanged);

        const panel = {
            componentId,
            componentItem,
            floatingStack,
            shell,
            title,
            actions: windowControls,
            body,
            handleTitleChanged,
            bounds: this.clampBounds(options.bounds ?? this.createDefaultBounds(componentItem.element.getBoundingClientRect())),
            zIndex: options.zIndex ?? this.bumpZIndex(),
            dockTarget: options.dockTarget ?? null
        };
        this.renderPanelControls(panel);
        return panel;
    }

    private renderPanelControls(panel: FloatingPanel): void {
        renderWindowControls(panel.actions, this.getWindowControls(panel.componentItem));
    }

    private getPanelInstanceId(panel: FloatingPanel): string | null {
        const state = panel.componentItem.container?.stateRequestEvent?.() as { instanceId?: string } | undefined;
        if (typeof state?.instanceId === "string") {
            return state.instanceId;
        }

        const root = panel.componentItem.element.querySelector<HTMLElement>("[data-instance-id]");
        return root?.dataset.instanceId ?? null;
    }

    private bumpZIndex(): number {
        this.nextZIndex += 1;
        return this.nextZIndex;
    }

    private focusPanel(panel: FloatingPanel): void {
        panel.zIndex = this.bumpZIndex();
        this.syncPanelZIndices(panel.componentId);
        this.onChanged();
    }

    private syncPanelZIndices(activePanelId?: string): void {
        const orderedPanels = [...this.panels.values()]
            .sort((left, right) => left.zIndex - right.zIndex);

        for (let index = 0; index < orderedPanels.length; index += 1) {
            const currentPanel = orderedPanels[index]!;
            currentPanel.shell.classList.toggle("active", currentPanel.componentId === activePanelId);
            currentPanel.shell.style.zIndex = String(index + 1);
        }
    }

    private beginMove(event: PointerEvent, componentId: string): void {
        if (event.button !== 0) {
            return;
        }

        const panel = this.panels.get(componentId);
        if (!panel) {
            return;
        }

        if ((event.target as HTMLElement).closest(".flint-floating-window-actions")) {
            return;
        }

        event.preventDefault();
        this.focusPanel(panel);
        panel.shell.classList.add(DRAGGING_CLASS);

        const startBounds = { ...panel.bounds };
        const startX = event.clientX;
        const startY = event.clientY;
        const move = (moveEvent: PointerEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            this.updatePanelBounds(panel, {
                x: startBounds.x + dx,
                y: startBounds.y + dy,
                width: startBounds.width,
                height: startBounds.height
            }, false);
            this.updateDockPreview(moveEvent.pageX, moveEvent.pageY);
        };
        const finish = () => {
            panel.shell.classList.remove(DRAGGING_CLASS);
            document.removeEventListener("pointermove", move);
            document.removeEventListener("pointerup", finish);
            if (this.activeDockPreview) {
                this.dockPanel(panel, true);
            } else {
                this.clearDockPreview();
                this.onChanged();
            }
        };

        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", finish);
    }

    private beginResize(event: PointerEvent, componentId: string, direction: ResizeDirection): void {
        if (event.button !== 0) {
            return;
        }

        const panel = this.panels.get(componentId);
        if (!panel) {
            return;
        }

        event.preventDefault();
        this.focusPanel(panel);
        const startBounds = { ...panel.bounds };
        const startX = event.clientX;
        const startY = event.clientY;

        const move = (moveEvent: PointerEvent) => {
            const dx = moveEvent.clientX - startX;
            const dy = moveEvent.clientY - startY;
            const minWidth = parsePixels(this.layout.layoutConfig.dimensions.defaultMinItemWidth, DEFAULT_FLOAT_WIDTH);
            const minHeight = parsePixels(this.layout.layoutConfig.dimensions.defaultMinItemHeight, DEFAULT_FLOAT_HEIGHT);
            const nextBounds = { ...startBounds };
            const rightEdge = startBounds.x + startBounds.width;
            const bottomEdge = startBounds.y + startBounds.height;

            if (direction.includes("e")) {
                nextBounds.width = Math.max(minWidth, startBounds.width + dx);
            }
            if (direction.includes("s")) {
                nextBounds.height = Math.max(minHeight, startBounds.height + dy);
            }
            if (direction.includes("w")) {
                nextBounds.width = Math.max(minWidth, startBounds.width - dx);
                nextBounds.x = rightEdge - nextBounds.width;
            }
            if (direction.includes("n")) {
                nextBounds.height = Math.max(minHeight, startBounds.height - dy);
                nextBounds.y = bottomEdge - nextBounds.height;
            }

            this.updatePanelBounds(panel, nextBounds, false);
        };
        const finish = () => {
            document.removeEventListener("pointermove", move);
            document.removeEventListener("pointerup", finish);
            this.onChanged();
        };

        document.addEventListener("pointermove", move);
        document.addEventListener("pointerup", finish);
    }

    public dockPanel(panel: FloatingPanel, useActivePreview = false): void {
        const preview = useActivePreview ? this.activeDockPreview : null;
        this.panels.delete(panel.componentId);
        panel.shell.remove();
        panel.componentItem.off("titleChanged", panel.handleTitleChanged);
        panel.floatingStack.removeChild(panel.componentItem, true);
        panel.floatingStack.destroy();

        if (preview && this.applyDockPreview(panel.componentItem)) {
            panel.componentItem.focus();
            this.onChanged();
            return;
        }

        const preferredStack = this.findDockStack(panel.dockTarget?.stackId);
        if (preferredStack) {
            const index = clamp(panel.dockTarget?.index ?? preferredStack.contentItems.length, 0, preferredStack.contentItems.length);
            preferredStack.addChild(panel.componentItem, index, true);
            panel.componentItem.focus();
            this.onChanged();
            return;
        }

        const fallbackStack = this.getFirstStack(this.layout.rootItem);
        if (fallbackStack) {
            fallbackStack.addChild(panel.componentItem, fallbackStack.contentItems.length, true);
            panel.componentItem.focus();
            this.onChanged();
            return;
        }

        throw new Error("Unable to find a dock target for floating panel.");
    }

    public hasActiveDockPreview(): boolean {
        return this.activeDockPreview !== null;
    }

    public moveFloatingPanel(panel: FloatingPanel, bounds: Bounds): void {
        this.updatePanelBounds(panel, bounds, false);
    }

    public persistFloatingPanel(panel: FloatingPanel): void {
        this.updatePanelBounds(panel, panel.bounds, true);
    }

    private findHoveredStack(node: ContentItem | undefined, pageX: number, pageY: number): InternalStack | null {
        if (!node) {
            return null;
        }

        for (const child of node.contentItems) {
            const match = this.findHoveredStack(child, pageX, pageY);
            if (match) {
                return match;
            }
        }

        if (!node.isStack) {
            return null;
        }

        const stack = node as InternalStack;
        const rect = stack.element.getBoundingClientRect();
        const clientX = pageX - window.scrollX;
        const clientY = pageY - window.scrollY;
        return isPointerInsideRect(clientX, clientY, rect) ? stack : null;
    }

    private findOuterDockTargetItem(stack: InternalStack, zone: OuterDockZone): InternalContentItem | null {
        const wantsHorizontalSplit = zone === "left" || zone === "right";
        let target: InternalContentItem = stack;

        while (target.parent && !target.parent.isGround) {
            const parent = target.parent as InternalContentItem;
            const shouldClimb = wantsHorizontalSplit ? parent.isColumn : parent.isRow;
            if (!shouldClimb) {
                break;
            }

            target = parent;
        }

        return target === stack ? null : target;
    }

    private createZoneHighlightArea(stack: InternalStack, contentRect: DOMRect, zone: DockZone): DockArea {
        const builtInArea = zone === "center" ? undefined : stack.contentAreaDimensions?.[zone]?.highlightArea;
        if (builtInArea) {
            return builtInArea;
        }

        const x1 = contentRect.left + window.scrollX;
        const y1 = contentRect.top + window.scrollY;
        const x2 = x1 + contentRect.width;
        const y2 = y1 + contentRect.height;
        const midX = x1 + contentRect.width / 2;
        const midY = y1 + contentRect.height / 2;

        if (zone === "center") {
            return {
                x1,
                y1,
                x2,
                y2,
                surface: contentRect.width * contentRect.height,
                contentItem: stack
            };
        }

        if (zone === "left") {
            return {
                x1,
                y1,
                x2: midX,
                y2,
                surface: (midX - x1) * contentRect.height,
                contentItem: stack
            };
        }

        if (zone === "right") {
            return {
                x1: midX,
                y1,
                x2,
                y2,
                surface: (x2 - midX) * contentRect.height,
                contentItem: stack
            };
        }

        if (zone === "top") {
            return {
                x1,
                y1,
                x2,
                y2: midY,
                surface: contentRect.width * (midY - y1),
                contentItem: stack
            };
        }

        return {
            x1,
            y1: midY,
            x2,
            y2,
            surface: contentRect.width * (y2 - midY),
            contentItem: stack
        };
    }

    private createOuterZoneHighlightArea(targetItem: InternalContentItem, zone: OuterDockZone): DockArea {
        const rect = targetItem.element.getBoundingClientRect();
        const x1 = rect.left + window.scrollX;
        const y1 = rect.top + window.scrollY;
        const x2 = x1 + rect.width;
        const y2 = y1 + rect.height;
        const midX = x1 + rect.width / 2;
        const midY = y1 + rect.height / 2;

        if (zone === "left") {
            return {
                x1,
                y1,
                x2: midX,
                y2,
                surface: (midX - x1) * rect.height,
                contentItem: targetItem
            };
        }

        if (zone === "right") {
            return {
                x1: midX,
                y1,
                x2,
                y2,
                surface: (x2 - midX) * rect.height,
                contentItem: targetItem
            };
        }

        if (zone === "top") {
            return {
                x1,
                y1,
                x2,
                y2: midY,
                surface: rect.width * (midY - y1),
                contentItem: targetItem
            };
        }

        return {
            x1,
            y1: midY,
            x2,
            y2,
            surface: rect.width * (y2 - midY),
            contentItem: targetItem
        };
    }

    private createDockedStack(componentItem: InternalComponentItem, parent: ContentItem): InternalStack {
        const stackConfig = {
            type: "stack",
            content: [],
            size: 50,
            sizeUnit: "percent",
            isClosable: true,
            activeItemIndex: 0,
            header: {
                show: "top",
                popout: false,
                close: "Close",
                maximise: "max",
                tabDropdown: "more"
            }
        };
        const stack = this.internalLayout.createAndInitContentItem(stackConfig, parent) as InternalStack;
        stack.addChild(componentItem, 0, true);
        return stack;
    }

    private createDockContainer(type: "row" | "column", parent: ContentItem): InternalContentItem {
        return this.internalLayout.createAndInitContentItem({ type, content: [] }, parent) as InternalContentItem;
    }

    private applyOuterDockPreview(componentItem: InternalComponentItem, targetItem: InternalContentItem, zone: OuterDockZone): void {
        const dockedStack = this.createDockedStack(componentItem, targetItem);
        const parent = targetItem.parent as InternalContentItem | null;
        const isVertical = zone === "top" || zone === "bottom";
        const insertBefore = zone === "top" || zone === "left";
        const requiredType = isVertical ? "column" : "row";

        if (parent && ((isVertical && parent.isColumn) || (!isVertical && parent.isRow))) {
            const index = parent.contentItems.indexOf(targetItem);
            parent.addChild(dockedStack, insertBefore ? index : index + 1, true);
            targetItem.size *= 0.5;
            dockedStack.size = targetItem.size;
            dockedStack.sizeUnit = targetItem.sizeUnit;
            parent.updateSize(false);
            return;
        }

        const rowOrColumnParent = (parent ?? this.internalLayout.groundItem) as InternalContentItem | undefined;
        if (!rowOrColumnParent) {
            throw new Error("GoldenLayout ground item is unavailable for outer docking.");
        }

        const container = this.createDockContainer(requiredType, rowOrColumnParent);
        rowOrColumnParent.replaceChild(targetItem, container, true);
        container.addChild(dockedStack, insertBefore ? 0 : undefined, true);
        container.addChild(targetItem, insertBefore ? undefined : 0, true);
        targetItem.size = 50;
        dockedStack.size = 50;
        dockedStack.sizeUnit = "percent";
        container.updateSize(false);
    }

    private findDockStack(stackId: string | null | undefined): Stack | null {
        if (!stackId) {
            return null;
        }

        return this.findContentItemById(this.layout.rootItem, stackId) as Stack | null;
    }

    private findContentItemById(node: ContentItem | undefined, id: string): ContentItem | null {
        if (!node) {
            return null;
        }

        if (node.id === id) {
            return node;
        }

        for (const child of node.contentItems) {
            const match = this.findContentItemById(child, id);
            if (match) {
                return match;
            }
        }

        return null;
    }

    private getFirstStack(node: ContentItem | undefined): Stack | null {
        if (!node) {
            return null;
        }

        if (node.isStack) {
            return node as Stack;
        }

        for (const child of node.contentItems) {
            const match = this.getFirstStack(child);
            if (match) {
                return match;
            }
        }

        return null;
    }

    private createDefaultBounds(sourceRect: DOMRect): Bounds {
        if (sourceRect.width > 0 && sourceRect.height > 0) {
            return this.boundsFromViewportRect(sourceRect);
        }

        return this.createResetBounds();
    }

    private createResetBounds(): Bounds {
        const hostRect = this.host.getBoundingClientRect();

        return this.clampBounds({
            x: (hostRect.width - DEFAULT_FLOAT_WIDTH) / 2,
            y: (hostRect.height - DEFAULT_FLOAT_HEIGHT) / 2,
            width: DEFAULT_FLOAT_WIDTH,
            height: DEFAULT_FLOAT_HEIGHT
        });
    }

    private clampBounds(bounds: Bounds): Bounds {
        const hostRect = this.host.getBoundingClientRect();
        const minWidth = parsePixels(this.layout.layoutConfig.dimensions.defaultMinItemWidth, DEFAULT_FLOAT_WIDTH);
        const minHeight = parsePixels(this.layout.layoutConfig.dimensions.defaultMinItemHeight, DEFAULT_FLOAT_HEIGHT);

        const width = clamp(bounds.width, minWidth, Math.max(minWidth, hostRect.width));
        const height = clamp(bounds.height, minHeight, Math.max(minHeight, hostRect.height));
        const x = clamp(bounds.x, -width + MIN_VISIBLE_MARGIN, Math.max(MIN_VISIBLE_MARGIN, hostRect.width - MIN_VISIBLE_MARGIN));
        const y = clamp(bounds.y, 0, Math.max(0, hostRect.height - MIN_VISIBLE_MARGIN));

        return { x, y, width, height };
    }

    private updatePanelBounds(panel: FloatingPanel, bounds: Bounds, persist: boolean): void {
        panel.bounds = this.clampBounds(bounds);
        panel.shell.style.left = `${panel.bounds.x}px`;
        panel.shell.style.top = `${panel.bounds.y}px`;
        panel.shell.style.width = `${panel.bounds.width}px`;
        panel.shell.style.height = `${panel.bounds.height}px`;
        this.syncFloatingStack(panel);
        if (persist) {
            this.onChanged();
        }
    }

    private syncFloatingStack(panel: FloatingPanel): void {
        panel.floatingStack.element.style.width = "100%";
        panel.floatingStack.element.style.height = "100%";
        requestAnimationFrame(() => {
            panel.floatingStack.updateSize(true);
        });
    }
}
