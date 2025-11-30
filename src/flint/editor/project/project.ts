import Component from "../../runtime/component";
import { System } from "../../runtime/system";
import Editor, { Notifier } from "../editor";
import Builder from "./builder";
import ProjectConfig from "./project-config";
import ModuleLoader from "./module-loader";
import type { AssetData } from "../windows/assets";
import { ComponentBuilder } from "../component-builder";
import Assets from "../windows/assets";

export class Project {
    private static compiled: string;
    public static folderHandle: FileSystemDirectoryHandle;

    private static createComponentDialog: HTMLElement & { show: () => void; hide: () => void };
    private static createComponentButton: HTMLButtonElement;
    private static createComponentInput: HTMLInputElement;

    private constructor() { }

    static {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Project.createComponentDialog = document.getElementById("create-component-dialog")! as any;

        Project.createComponentButton = Project.createComponentDialog.querySelector("sl-button") as HTMLButtonElement;
        Project.createComponentButton.addEventListener("click", () => {
            Project.createComponentDialog.hide();
            Project.createComponent(Project.createComponentInput.value.trim());
        });

        Project.createComponentInput = Project.createComponentDialog.querySelector("sl-input") as HTMLInputElement;
        Project.createComponentInput.addEventListener("sl-input", () => {
            Project.createComponentButton.disabled = Project.createComponentInput.value.trim() === "";
        });
    }

    public static async openProject(folderHandle: FileSystemDirectoryHandle) {
        Project.folderHandle = folderHandle;
        await ProjectConfig.ensureLoaded();
        await Project.getAllTextFiles(Project.folderHandle);
    }

    public static async newProject(folderHandle: FileSystemDirectoryHandle) {
        Project.folderHandle = folderHandle;
        await ProjectConfig.ensureLoaded();
        await Project.getAllTextFiles(Project.folderHandle);

    }

    public static async getAllTextFiles(dirHandle: FileSystemDirectoryHandle, path = ""): Promise<{ fileHandle: FileSystemFileHandle, path: string }[]> {
        const files: { fileHandle: FileSystemFileHandle, path: string }[] = [];

        for await (const [name, handle] of dirHandle.entries()) {
            if (handle.kind === "file" && (name.endsWith(".ts") || name.endsWith(".json"))) {
                Editor.assetsWindow.addAsset({
                    id: crypto.randomUUID(),
                    name,
                    type: name.split(".").pop() === "ts" ? "component" : "json",
                    path: "/" + path + name
                });

                files.push({ fileHandle: handle, path: path + name });
            } else if (handle.kind === "directory") {
                Editor.assetsWindow.addAsset({
                    id: crypto.randomUUID(),
                    name,
                    type: "folder",
                    path: "/" + path + name
                });

                const nestedFiles = await Project.getAllTextFiles(handle, path + name + "/");
                files.push(...nestedFiles);
            }
        }

        return files;
    }


    public static async compile(): Promise<boolean> {
        Builder.files.clear();
        Editor.assetsWindow.clearAssets();

        const tsFiles = await Project.getAllTextFiles(Project.folderHandle);


        Builder.files.set("index.ts", ProjectConfig.config.index);

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
                if (name === "System" || name === "Input" || name === "Metadata") continue;

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

    public static async openInFileEditor(path: string) {
        if (!ProjectConfig.config.rootPath) {
            const path = prompt("Due to browser restrictions - to open file in VSCode enter absolute path to your project folder:", "C:/path/to/your/project/folder");
            if (!path) {
                return;
            }
            ProjectConfig.config.rootPath = path;
            await ProjectConfig.save();
        }

        window.location.href = "vscode://file/" + ProjectConfig.config.rootPath + path;
    }

    public static showCreateComponentWindow() {
        Project.createComponentButton.disabled = true;
        Project.createComponentInput.value = "";
        Project.createComponentDialog.show();
    }

    public static async createComponent(name: string) {
        const fileBaseName = ComponentBuilder.splitPascalCase(name, "-");

        const assetPath = Editor.assetsWindow.currentPath.replace(/^\//, "");

        const relativeFilePath = `${assetPath}/${fileBaseName}.ts`;

        const fileContent =
            `import Component from "./flint/runtime/component";

export class ${name} extends Component {
    onAttach() {
        // Component initialization code
    }

    onUpdate() {
        // Code which should run every frame
    }
}
`;
        let folderHandle = Project.folderHandle;
        const parts = assetPath.split("/").filter(Boolean);

        for (const part of parts) {
            folderHandle = await folderHandle.getDirectoryHandle(part, { create: true });
        }

        const fileHandle = await folderHandle.getFileHandle(fileBaseName + ".ts", { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(fileContent);
        await writable.close();

        Editor.assetsWindow.addAsset({
            id: crypto.randomUUID(),
            name: fileBaseName + ".ts",
            type: "component",
            path: `${assetPath}/${fileBaseName}.ts`
        });

        const exportPath = `${assetPath}/${fileBaseName}`;
        ProjectConfig.config.index += `export * from "./${exportPath}";`;
        await ProjectConfig.save();

        Project.openInFileEditor("/" + relativeFilePath);
    }
}