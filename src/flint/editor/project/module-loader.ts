/* eslint-disable @typescript-eslint/no-explicit-any */
import { AssetRegistry } from "@flint/runtime/assets";
import { System } from "@flint/runtime/system";
import { TimerSystem } from "@flint/runtime/timers";
import Input from "@flint/shared/input";
import Metadata from "@flint/shared/metadata";
import Camera from "@flint/runtime/components/camera";

export default class ModuleLoader {
    private constructor() { }

    public static createTempURL(code: string, type = "text/javascript") {
        const blob = new Blob([code], { type });
        return URL.createObjectURL(blob);
    }

    public static deleteTempUrl(url: string) {
        URL.revokeObjectURL(url);
    }

    public static async load(module: string) {
        const url = this.createTempURL(module);
        const loadedModule = await import(url);
        this.deleteTempUrl(url);

        if (loadedModule.System) {
            for (const key of Object.keys(System)) {
                loadedModule.System[key] = (System as any)[key];
            }

            // for (const [name, component] of System.components) {
            //     if (loadedModule.System.components[name]) {
            //         loadedModule.System.components[name] = component;
            //     }
            // }

            Object.defineProperty(loadedModule.System, "deltaTime", {
                configurable: true,
                enumerable: true,
                get: function () {
                    return System.deltaTime;
                }
            });
        }

        const assigns = {
            [loadedModule.Input]: Input,
            [loadedModule.Metadata]: Metadata,
            [loadedModule.AssetRegistry]: AssetRegistry,
            [loadedModule.TimerSystem]: TimerSystem,
            [loadedModule.Camera]: Camera
        };

        for (const [assignTo, assign] of Object.entries(assigns)) {
            if (assignTo) {
                Object.assign(assignTo, assign);
            }
        }

        if (loadedModule.Metadata) {
            Metadata.importFrom(loadedModule.Metadata);
        }

        if (loadedModule.Camera) {
            // Proxy main so it always reads/writes the editor's Camera.main
            // (the loaded module's Camera class is a separate copy from the bundler)
            Object.defineProperty(loadedModule.Camera, "main", {
                configurable: true,
                enumerable: true,
                get() { return Camera.main; },
                set(v) { Camera.main = v; }
            });
        }

        return loadedModule;
    }
}
