import Component from "../../runtime/component.js";
import type Layer from "../../runtime/layer.js";
import { System } from "../../runtime/system.js";
import Builder from "./builder.js";
import ModuleLoader from "./module-loader.js";

export class Project {
    private static compiled: string;
    public static folderHandle: FileSystemDirectoryHandle;

    private constructor() { }

    public static async newProject(folderHandle: FileSystemDirectoryHandle) {
        Project.folderHandle = folderHandle;

        try {
            await Project.folderHandle.getFileHandle("index.ts", { create: true });

        } catch (error) {
            console.error(`Error: ${error}`);
        }
        return "";
    }

    public static async getAllTsFiles(dirHandle: FileSystemDirectoryHandle, path = ""): Promise<{ fileHandle: FileSystemFileHandle, path: string }[]> {
        const files: { fileHandle: FileSystemFileHandle, path: string }[] = [];

        for await (const [name, handle] of dirHandle.entries()) {
            if (handle.kind === "file" && name.endsWith(".ts")) {
                files.push({ fileHandle: handle, path: path + name });
            } else if (handle.kind === "directory") {
                const nestedFiles = await Project.getAllTsFiles(handle, path + name + "/");
                files.push(...nestedFiles);
            }
        }

        return files;
    }


    public static async compile(): Promise<boolean> {
        const tsFiles = await Project.getAllTsFiles(Project.folderHandle);
        Builder.files.clear();

        for (const { fileHandle, path } of tsFiles) {
            const file = await fileHandle.getFile();
            const text = await file.text();

            Builder.files.set(path, text);
        }
        const result = (await Builder.build()).outputFiles[0]?.text;

        if (!result) return false;

        this.compiled = result;
        return true;
    }

    public static async run() {
        if (!this.folderHandle) return;
        
        if (await this.compile()) {
            const module = await ModuleLoader.load(this.compiled);

            for (const [name, value] of Object.entries(module)) {
                const oldComponentType = System.customComponents.get(name);
                if (value as Component) {
                    System.customComponents.set(name, value as typeof Component);
                }


                const component = System.customComponents.get(name);
                if (component) {
                    const obj = (System.layers[1] as Layer).getObjects()[0];
                    if (!obj) {
                        return;
                    }
                    if (!oldComponentType) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        obj.addComponent(new (component as any)());
                        return;
                    }

                    const objComponent = obj.getComponent(oldComponentType);
                    if (!objComponent) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        obj.addComponent(new (component as any)());
                        return;
                    }

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    obj.addComponent(objComponent.swapClass((component as any)));
                    obj.removeComponent(oldComponentType);

                }
            }


            //     DynamicModuleLoader.unloadAll();

            //     const className = Builder.extractClassName(this.source);
            //     if (!className) throw new Error("Class not found");

            //     this.compiled += `
            // return ${className};
            //     `;
            //     console.log(className);

            //     let script: HTMLScriptElement;
            //     try {
            //         const script = document.createElement("script");
            //         script.innerHTML = this.compiled;
            //         document.body.appendChild(script);
            //     } catch (error) {
            //         console.log(error);
            //     }

        }
    }
}