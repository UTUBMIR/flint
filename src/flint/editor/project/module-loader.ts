/* eslint-disable @typescript-eslint/no-explicit-any */
import { System } from "../../runtime/system";
import Input from "../../shared/input";
import Metadata from "../../shared/metadata";

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
        }

        if (loadedModule.Input) {
            for (const key of Object.keys(Input)) {
                loadedModule.Input[key] = (Input as any)[key];
            }
        }

        if (loadedModule.Metadata) {
            Metadata.importFrom(loadedModule.Metadata);
            for (const key of Object.keys(Metadata)) {
                loadedModule.Metadata[key] = (Metadata as any)[key];
            }
        }

        return loadedModule;
    }
}