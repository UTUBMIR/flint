import type Component from "./component";
import type { System } from "./system";
import type Camera from "./components/camera";
import type Input from "@flint/shared/input";
import type Metadata from "@flint/shared/metadata";
import type { AssetRegistry } from "./assets";
import type { TimerSystem } from "./timers";
import type { HotReload } from "./hot-reload";

export type EngineSingletons = {
    System: typeof System;
    Camera: typeof Camera;
    Input: typeof Input;
    Metadata: typeof Metadata;
    AssetRegistry: typeof AssetRegistry;
    TimerSystem: typeof TimerSystem;
    HotReload: typeof HotReload;
};

export type HotReloadModule = EngineSingletons & {
    [name: string]: unknown;
};

export function mergeEngineSingletons(loaded: HotReloadModule, source: EngineSingletons) {
    if (!loaded.System) return;

    const loadedSystem = loaded.System as unknown as Record<string, unknown>;
    const sourceSystem = source.System as unknown as Record<string, unknown>;

    for (const key of Object.keys(sourceSystem)) {
        loadedSystem[key] = sourceSystem[key];
    }

    Object.defineProperty(loaded.System, "deltaTime", {
        configurable: true,
        enumerable: true,
        get: function () {
            return source.System.deltaTime;
        }
    });

    const assigns = new Map<unknown, unknown>([
        [loaded.Input, source.Input],
        [loaded.Metadata, source.Metadata],
        [loaded.AssetRegistry, source.AssetRegistry],
        [loaded.TimerSystem, source.TimerSystem],
        [loaded.Camera, source.Camera]
    ]);

    for (const [assignTo, assign] of assigns) {
        if (assignTo) {
            Object.assign(assignTo, assign);
        }
    }

    source.Metadata.importFrom(loaded.Metadata);

    Object.defineProperty(loaded.Camera, "main", {
        configurable: true,
        enumerable: true,
        get() {
            return source.Camera.main;
        },
        set(v) {
            source.Camera.main = v;
        }
    });
}

export class HotReloadBridge {
    private constructor() { }

    public static async apply(code: string, components: string[], source: EngineSingletons): Promise<void> {
        const url = URL.createObjectURL(new Blob([code], { type: "text/javascript" }));

        try {
            const loaded = (await import(url)) as HotReloadModule;

            mergeEngineSingletons(loaded, source);

            for (const name of components) {
                const componentType = loaded[name] as typeof Component | undefined;
                if (componentType) {
                    source.HotReload.reloadComponent(name, componentType);
                }
            }
        }
        catch (error) {
            console.error("Hot reload failed:", error);
        }
        finally {
            URL.revokeObjectURL(url);
        }
    }
}
