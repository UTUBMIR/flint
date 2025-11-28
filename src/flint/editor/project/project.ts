import Component from "../../runtime/component";
import type Layer from "../../runtime/layer";
import { System } from "../../runtime/system";
import { Notifier } from "../editor";
import Builder from "./builder";
import ModuleLoader from "./module-loader";

export class Project {
    private static compiled: string;
    public static folderHandle: FileSystemDirectoryHandle;

    private constructor() { }

    public static openProject(folderHandle: FileSystemDirectoryHandle) {
        Project.folderHandle = folderHandle;
    }

    public static async newProject(folderHandle: FileSystemDirectoryHandle) {
        Project.folderHandle = folderHandle;

        const files: { name: string, content: string }[] = [
            { name: "index.ts", content: `export * from "./shared.ts";` },
            {
                name: "shared.ts", content:
                    `import Input from "./flint/shared/input";
import { System } from "./flint/runtime/system";

export let shared = { Input, System };`},
        ];

        try {
            for (const file of files) {
                // Create or get the file handle
                const fileHandle = await Project.folderHandle.getFileHandle(file.name, { create: true });

                // Create a writable stream
                const writable = await fileHandle.createWritable();

                // Write the file content
                await writable.write(file.content);

                // Close the stream to save changes
                await writable.close();
            }
        } catch (error) {
            console.error(`Error writing files: ${error}`);
        }
    }

    public static async getAllTsFiles(dirHandle: FileSystemDirectoryHandle, path = ""): Promise<{ fileHandle: FileSystemFileHandle, path: string }[]> {
        const files: { fileHandle: FileSystemFileHandle, path: string }[] = [];

        for await (const [name, handle] of dirHandle.entries()) {
            if (handle.kind === "file" && (name.endsWith(".ts") || name.endsWith(".json"))) {
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
        try {
            const result = (await Builder.build()).outputFiles[0]?.text;

            if (!result) return false;

            this.compiled = result;
            return true;
        }
        catch (error) {
            Notifier.notify(`${error}`, "danger", 15000);
            return false;
        }
    }

    public static async run(): Promise<boolean> {
        if (!this.folderHandle) {
            Notifier.notify("Open project first.", "danger");
            return false;
        }

        if (await this.compile()) {
            const module = await ModuleLoader.load(this.compiled);

            for (const [name, value] of Object.entries(module)) {
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
        else {
            return false;
        }

        return true;
    }
}