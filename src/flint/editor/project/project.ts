import Builder from "./builder.js";
import Component from "../../runtime/component.js";
import { System } from "../../runtime/system.js";
import { DynamicModuleLoader } from "./module-loader.js";
import type Layer from "../../runtime/layer.js";

export class Project {
    private static source: string;
    private static compiled: string;
    public static folderHandle: FileSystemDirectoryHandle;

    private constructor() { }

    public static async newProject(folderHandle: FileSystemDirectoryHandle): Promise<string> {
        this.folderHandle = folderHandle;

        try {
            return await (
                await (
                    await this.folderHandle.getFileHandle("main.ts", { create: true })
                )
                    .getFile())
                .text();

        } catch (error) {
            console.error(`Error: ${error}`);
        }
        return "";
    }


    public static async compile() {
        this.source = Builder.build(
            await (
                await (
                    await this.folderHandle.getFileHandle("main.ts", { create: true })
                )
                    .getFile())
                .text()
        );

        this.compiled = this.source;
    }

    public static async run() {
        await this.compile();

        const loaded = await DynamicModuleLoader.loadModule("temp", this.compiled, {deps: Component});
        if (loaded.default as Component) {
            System.customComponents.set(loaded.default.name, loaded.default);
        }
        
        const component = System.customComponents.get(loaded.default.name);
        if (component) {
            (System.layers[1] as Layer).getObjects()[0]?.addComponent(new (component as any)());
        }

        DynamicModuleLoader.unloadAll();

//         const className = Builder.extractClassName(this.source);
//         if (!className) throw new Error("Class not found");

//         this.compiled += `
// return ${className};
//     `;
//         console.log(className);

//         let script: HTMLScriptElement;
//         try {
//             const script = document.createElement("script");
//             script.innerHTML = this.compiled;
//             document.body.appendChild(script);
//         } catch (error) {
//             console.log(error);
//         }


//         Cls = System.customComponents[className];
//         if (Cls) {
//             new (Cls as any)().onAttach();
//         }
    }
}