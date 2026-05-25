import type { ComponentContainer, GoldenLayout } from "golden-layout";
import type { activeWindowService, editorAssetStore, editorSelectionService } from "./window-services";

export type WindowType = "Viewport" | "Game" | "CodeEditor" | "Hierarchy" | "Assets" | "Inspector";

export type WindowServices = {
    selection: typeof editorSelectionService;
    assets: typeof editorAssetStore;
    activeWindows: typeof activeWindowService;
};

export type WindowManagerApi = {
    layout: GoldenLayout;
    activateWindow: (instanceId: string) => void;
    refreshWindows: (type?: WindowType) => void;
    refreshWindowControls: (instanceId: string) => void;
    spawnWindow: (type: WindowType, options?: SpawnWindowOptions) => string;
};

export type WindowContext = {
    instanceId: string;
    type: WindowType;
    root: HTMLElement;
    container: ComponentContainer;
    services: WindowServices;
    manager: WindowManagerApi;
};

export type EditorWindowState = Record<string, unknown> | undefined;

export type EditorWindowControl = {
    id: string;
    icon: string;
    title: string;
    ariaLabel: string;
    active?: boolean;
    disabled?: boolean;
    onClick: () => void;
};

export interface EditorWindow {
    readonly type: WindowType;
    readonly instanceId: string;
    readonly root: HTMLElement;
    initialize(): void | Promise<void>;
    restoreState(state: EditorWindowState): void;
    serializeState(): EditorWindowState;
    getControls?(): readonly EditorWindowControl[];
    update?(): void;
    onActivate?(): void;
    dispose(): void;
}

export abstract class BaseEditorWindow implements EditorWindow {
    public readonly type: WindowType;
    public readonly instanceId: string;
    public readonly root: HTMLElement;
    protected readonly context: WindowContext;
    private readonly cleanupCallbacks: Array<() => void> = [];

    protected constructor(context: WindowContext) {
        this.context = context;
        this.type = context.type;
        this.instanceId = context.instanceId;
        this.root = context.root;
    }

    public initialize(): void | Promise<void> { }
    public restoreState(_state: EditorWindowState): void { }
    public serializeState(): EditorWindowState { return undefined; }
    public getControls(): readonly EditorWindowControl[] { return []; }
    public onActivate(): void { }

    protected setTitle(title: string): void {
        this.context.container.setTitle(title);
    }

    protected refreshControls(): void {
        this.context.manager.refreshWindowControls(this.instanceId);
    }

    protected query<T extends Element>(selector: string): T {
        const result = this.root.querySelector<T>(selector);
        if (!result) {
            throw new Error(`Element "${selector}" was not found in ${this.type} window.`);
        }

        return result;
    }

    protected queryOptional<T extends Element>(selector: string): T | null {
        return this.root.querySelector<T>(selector);
    }

    protected listen<K extends keyof HTMLElementEventMap>(
        target: HTMLElement | Document | Window | Element,
        eventName: K,
        handler: (event: HTMLElementEventMap[K]) => void,
        options?: boolean | AddEventListenerOptions
    ): void {
        const typedHandler = handler as EventListener;
        target.addEventListener(eventName, typedHandler, options);
        this.cleanupCallbacks.push(() => {
            target.removeEventListener(eventName, typedHandler, options);
        });
    }

    protected registerCleanup(callback: () => void): void {
        this.cleanupCallbacks.push(callback);
    }

    public dispose(): void {
        for (let i = this.cleanupCallbacks.length - 1; i >= 0; --i) {
            this.cleanupCallbacks[i]!();
        }
    }
}

export type WindowDefinition = {
    type: WindowType;
    title: string;
    create: (context: WindowContext) => EditorWindow;
};

export type SpawnWindowOptions = {
    title?: string;
    state?: EditorWindowState;
};
