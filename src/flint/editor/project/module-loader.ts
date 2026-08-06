import { AssetRegistry } from "@flint/runtime/assets";
import { System } from "@flint/runtime/system";
import { TimerSystem } from "@flint/runtime/timers";
import Input from "@flint/shared/input";
import Metadata from "@flint/shared/metadata";
import Camera from "@flint/runtime/components/camera";
import { HotReload } from "@flint/runtime/hot-reload";
import { mergeEngineSingletons, type HotReloadModule } from "@flint/runtime/hot-reload-bridge";

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
        const loadedModule = await import(url) as HotReloadModule;
        this.deleteTempUrl(url);

        mergeEngineSingletons(loadedModule, {
            System,
            Camera,
            Input,
            Metadata,
            AssetRegistry,
            TimerSystem,
            HotReload
        });

        return loadedModule;
    }
}
