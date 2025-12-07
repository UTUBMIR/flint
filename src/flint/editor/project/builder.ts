import type Component from "../..//runtime/component";
import { System } from "../../runtime/system";
import Editor, { Notifier } from "../../editor/editor";
import Bundler from "./bundler";
import ModuleLoader from "./module-loader";
import { Project } from "./project";
import ProjectConfig from "./project-config";

export class Builder {
    private static compiled: string;

    private constructor() { }

    public static async compile(emitErrorMessages: boolean = true, entryPoint?: string): Promise<boolean> {
        const textFilesResult = await Project.getAllTextFiles(Project.folderHandle);
        const textFiles = textFilesResult.files;
        const textAssets = textFilesResult.assets;

        Bundler.files.set("index.ts", ProjectConfig.config.index);

        for (const { fileHandle, path } of textFiles) {
            const file = await fileHandle.getFile();
            const text = await file.text();

            Bundler.files.set(path, text);
        }
        try {
            const result = (await Bundler.bundle(entryPoint)).outputFiles[0]?.text;

            if (!result) return false;

            this.compiled = result;

            Editor.assetsWindow.clearAssets();
            for (const asset of textAssets) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                Editor.assetsWindow.addAsset(asset as any);//FIXME: WTF?!?
            }

            return true;
        }
        catch (error) {
            if (emitErrorMessages) {
                Notifier.notify(`${error}`, "danger", 15000);
            }
            return false;
        }
    }

    public static async build(): Promise<boolean> {
        if (!Project.folderHandle) {
            Notifier.notify("Open project first.", "danger");
            return false;
        }

        const buildFolder = await Project.folderHandle.getDirectoryHandle("build", { create: true });

        Bundler.files.clear();
        Bundler.files.set("main.ts", `import * from "./index";
`);

        if (await Builder.compile(true, "/main.ts")) {
            // const module = await ModuleLoader.load(Builder.compiled);

            // for (const [name, value] of Object.entries(module)) {
            //     if (name === "System" || name === "Input" || name === "Metadata") continue;

            //     const oldComponentType = System.components.get(name);
            //     if (value as Component) {
            //         System.components.set(name, value as typeof Component);
            //     }

            //     if (!oldComponentType || !oldComponentType.prototype) {
            //         return true;
            //     }


            //     const component = System.components.get(name);
            //     if (!component) return false;

            //     for (const layer of System.layers) {
            //         for (const obj of layer.getObjects()) {
            //             const objComponent = obj.getComponent(oldComponentType);
            //             if (!objComponent) {
            //                 continue;
            //             }

            //             // eslint-disable-next-line @typescript-eslint/no-explicit-any
            //             obj.addComponent(objComponent.swapClass((component as any)));
            //             obj.removeComponent(oldComponentType);
            //         }
            //     }

            // }
            const fileHandle = await buildFolder.getFileHandle("main.js", { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(Builder.compiled);
            await writable.close();
        }
        else {
            return false;
        }

        return true;
    }

    public static async buildForEditor(emitErrorMessages: boolean = true): Promise<boolean> {
        if (!Project.folderHandle) {
            Notifier.notify("Open project first.", "danger");
            return false;
        }

        Bundler.files.clear();
        if (await Builder.compile(emitErrorMessages)) {
            const module = await ModuleLoader.load(Builder.compiled);

            for (const name of ProjectConfig.config.components.map(c => c.name)) {
                console.log(name);
                console.log(module);
                const value = module[name];

                const oldComponentType = System.components.get(name);
                if (value as Component) {
                    System.components.set(name, value as typeof Component);
                }

                if (!oldComponentType || !oldComponentType.prototype) {
                    return true;
                }


                const component = System.components.get(name);
                if (!component) return false;

                for (const layer of System.layers) {
                    for (const obj of layer.getObjects()) {
                        const objComponent = obj.getComponent(oldComponentType);
                        if (!objComponent) {
                            continue;
                        }

                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        obj.addComponent(objComponent.swapClass((component as any)));
                        obj.removeComponent(oldComponentType);
                    }
                }

            }
        }
        else {
            return false;
        }

        return true;
    }
}