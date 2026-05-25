import type GameObject from "@flint/runtime/game-object";
import { System, type UUID } from "@flint/runtime/system";
import type Layer from "@flint/runtime/layer";
import type { AssetData } from "../asset-types";
import type { WindowType } from "./window-framework";

type Listener<T> = (value: T) => void;
type Unsubscribe = () => void;

class SelectionService {
    private selectedId: UUID | null = null;
    private readonly listeners = new Set<Listener<UUID | null>>();

    public subscribe(listener: Listener<UUID | null>): Unsubscribe {
        this.listeners.add(listener);
        listener(this.selectedId);
        return () => {
            this.listeners.delete(listener);
        };
    }

    public setSelectedId(id: UUID | null): void {
        this.selectedId = id;
        for (const listener of this.listeners) {
            listener(id);
        }
    }

    public getSelectedId(): UUID | null {
        return this.selectedId;
    }

    public getSelectedGameObject(): GameObject | undefined {
        if (!this.selectedId) {
            return undefined;
        }

        return System.world.getGameObjectById(this.selectedId);
    }

    public getSelectedItem(): GameObject | Layer | undefined {
        if (!this.selectedId) {
            return undefined;
        }

        return System.world.getById(this.selectedId);
    }
}

class AssetStore {
    private assets: AssetData[] = [];
    private readonly listeners = new Set<Listener<readonly AssetData[]>>();

    public subscribe(listener: Listener<readonly AssetData[]>): Unsubscribe {
        this.listeners.add(listener);
        listener(this.assets);
        return () => {
            this.listeners.delete(listener);
        };
    }

    public getAssets(): readonly AssetData[] {
        return this.assets;
    }

    public setAssets(assets: readonly AssetData[]): void {
        this.assets = [...assets];
        this.emit();
    }

    public clear(): void {
        this.assets = [];
        this.emit();
    }

    public add(asset: AssetData): void {
        this.assets = [...this.assets, asset];
        this.emit();
    }

    public remove(path: string): void {
        this.assets = this.assets.filter(asset => !asset.path.startsWith(path));
        this.emit();
    }

    private emit(): void {
        for (const listener of this.listeners) {
            listener(this.assets);
        }
    }
}

class ActiveWindowService {
    private readonly activeWindowIds = new Map<WindowType, string>();
    private readonly assetsWindowPaths = new Map<string, string>();

    public setActiveWindow(type: WindowType, instanceId: string): void {
        this.activeWindowIds.set(type, instanceId);
    }

    public getActiveWindow(type: WindowType): string | undefined {
        return this.activeWindowIds.get(type);
    }

    public removeWindow(instanceId: string): void {
        for (const [type, activeId] of this.activeWindowIds) {
            if (activeId === instanceId) {
                this.activeWindowIds.delete(type);
            }
        }

        this.assetsWindowPaths.delete(instanceId);
    }

    public setAssetsWindowPath(instanceId: string, path: string): void {
        this.assetsWindowPaths.set(instanceId, path);
    }

    public getPreferredAssetsPath(): string {
        const activeAssetsWindowId = this.getActiveWindow("Assets");
        if (activeAssetsWindowId) {
            return this.assetsWindowPaths.get(activeAssetsWindowId) ?? "/assets";
        }

        const firstKnownPath = this.assetsWindowPaths.values().next();
        return firstKnownPath.done ? "/assets" : firstKnownPath.value;
    }
}

export const editorSelectionService = new SelectionService();
export const editorAssetStore = new AssetStore();
export const activeWindowService = new ActiveWindowService();
