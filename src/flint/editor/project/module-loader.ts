import { System } from "../../runtime/system";
import Input from "../../shared/input";

export default class ModuleLoader {
    private constructor() { }

    private static createTempURL(code: string, type = "text/javascript"): string {
        const blob = new Blob([code], { type });
        return URL.createObjectURL(blob);
    }

    private static deleteTempUrl(url: string) {
        URL.revokeObjectURL(url);
    }

    public static async load(module: string) {
        const url = ModuleLoader.createTempURL(module);
        const loadedModule = await import(url);
        ModuleLoader.deleteTempUrl(url);

        if (loadedModule.shared) {
            loadedModule.shared.System = System;
            loadedModule.shared.Input = Input;
        }

        return loadedModule;
    }
}