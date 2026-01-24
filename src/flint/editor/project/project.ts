import Editor from "../editor";
import ProjectConfig from "./project-config";
import { ComponentBuilder } from "../component-builder";
import { Builder } from "./builder";
import { System, type UUID } from "../../runtime/system";
import Metadata from "../../shared/metadata";
import { ProjectLoader } from "../../runtime/project-loader";
import { AbstractFileSystem as AbstractFileSystem } from "../../shared/file-system";
import { AssetRegistry } from "../../runtime/assets";
import { EditorLayer as EditorLayer } from "../editor-layer";

import type SlInput from "@shoelace-style/shoelace/dist/components/input/input.js";
import type SlButton from "@shoelace-style/shoelace/dist/components/button/button.js";
// export class FileTracker {
//     private constructor() { }

//     static timestamps = new Map<string, number>();
//     static intervalId: number | null = null;

//     private static debounceTimer: number | null = null;
//     private static debounceDelay = 200; // auto adjustable

//     static async startWatchingDirectory(
//         dirHandle: FileSystemDirectoryHandle
//     ) {
//         if (this.intervalId !== null) return;

//         this.intervalId = setInterval(async () => {
//             const updated = await this.directoryWasUpdated(dirHandle);
//             if (updated) {
//                 this.scheduleRebuild();
//             }
//         }, this.debounceDelay);
//     }

//     static stopWatching() {
//         if (this.intervalId !== null) {
//             clearInterval(this.intervalId);
//             this.intervalId = null;
//         }

//         if (this.debounceTimer !== null) {
//             clearTimeout(this.debounceTimer);
//             this.debounceTimer = null;
//         }
//     }

//     private static scheduleRebuild() {
//         /* If timer already started -> stop it and start a new one */
//         if (this.debounceTimer !== null) {
//             clearTimeout(this.debounceTimer);
//         }

//         this.debounceTimer = setTimeout(async () => {
//             const start = performance.now();
//             await Builder.buildForEditor(false);
//             const end = performance.now();

//             FileTracker.debounceDelay = end - start;
//             this.stopWatching();
//             this.startWatchingDirectory(Project.folderHandle);

//             this.debounceTimer = null;
//         }, this.debounceDelay);
//     }

//     private static async directoryWasUpdated(
//         dirHandle: FileSystemDirectoryHandle,
//         currentPath = ""
//     ) {
//         let anyUpdated = false;

//         for await (const entry of dirHandle.values()) {
//             const fullPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

//             if (entry.kind === "file") {
//                 if (fullPath.endsWith("metadata.json")) continue; // dont react on metadata updates

//                 const fileUpdated = await this.wasUpdated(fullPath, entry);
//                 if (fileUpdated) anyUpdated = true;
//             }

//             if (entry.kind === "directory") {
//                 const subUpdated = await this.directoryWasUpdated(entry, fullPath);
//                 if (subUpdated) anyUpdated = true;
//             }
//         }

//         return anyUpdated;
//     }

//     private static async wasUpdated(path: string, fileHandle: FileSystemFileHandle) {
//         const file = await fileHandle.getFile();
//         const newTimestamp = file.lastModified;
//         const prevTimestamp = this.timestamps.get(path);

//         this.timestamps.set(path, newTimestamp);

//         return prevTimestamp !== undefined && prevTimestamp !== newTimestamp;
//     }
// }


export class Project {
    private static createComponentDialog: HTMLElement & { show: () => void; hide: () => void };
    private static createComponentButton: SlButton;
    private static createComponentInput: SlInput;

    public static names: Map<UUID, string> = new Map();

    private constructor() { }

    static {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        Project.createComponentDialog = document.getElementById("create-component-dialog")! as any;

        Project.createComponentButton = Project.createComponentDialog.querySelector("sl-button") as SlButton;
        Project.createComponentButton.addEventListener("click", () => {
            Project.createComponentDialog.hide();
            Project.createComponent(Project.createComponentInput.value.trim());
        });

        Project.createComponentInput = Project.createComponentDialog.querySelector("sl-input") as SlInput;
        Project.createComponentInput.addEventListener("sl-input", () => {
            Project.createComponentButton.disabled = Project.createComponentInput.value.trim() === "";
        });
    }

    public static async run() {
        await Project.saveProject();
        return await Builder.buildForEditor();
    }

    public static async stop() {
        const success = await Project.loadProject();
        Editor.hierarchyWindow.update();

        if (Editor.inspectorWindow.currentObject) {
            Editor.inspectorWindow.currentObject = System.world.getGameObjectById(Editor.inspectorWindow.currentObject.id);
        }
        return success;
    }

    public static async openProject(folderHandle: FileSystemDirectoryHandle) {
        await Project.startupProject(folderHandle);
        await Project.loadProject();
        Editor.hierarchyWindow.update();

        // setInterval(async () => {
        //     await Project.saveProject();
        // }, 60000); // FIXME: implement autosave in a better way
    }

    public static async newProject(folderHandle: FileSystemDirectoryHandle) {
        if (await Project.startupProject(folderHandle) || !await Project.loadProject()) {
            System.world.addLayer(Editor.defaultLayer);
            Editor.hierarchyWindow.update();
        }

        await Project.saveProject();
        System.world.addLayer(new EditorLayer());
        Editor.hierarchyWindow.update();

        // setInterval(async () => {
        //     await Project.saveProject();
        // }, 60000); // FIXME: implement autosave in a better way
    }

    public static async buildAndRun() {
        return !!(+await Builder.build() & +await Builder.preview());
    }

    public static async saveProject() {
        const data = ProjectLoader.serialize({ layers: System.world.getLayers().filter(l => !(l instanceof EditorLayer)), assets: AssetRegistry.serialize() });
        const blob = new Blob([data], { type: "text/plain" });
        const cs = new CompressionStream("gzip");
        const compressed = new Response(blob.stream().pipeThrough(cs));
        const arrayBuffer = await compressed.arrayBuffer();

        await System.fileSystem.writeFile(
            "project.gz",
            new Uint8Array(arrayBuffer)
        );

        await Metadata.saveToFile(System.world.getLayers().filter(l => !(l instanceof EditorLayer)));
    }

    private static async loadProject() {
        try {
            const compressed = await System.fileSystem.readFile("project.gz");

            const buffer = AbstractFileSystem.toArrayBuffer(compressed);

            const stream = new Blob([buffer])
                .stream()
                .pipeThrough(new DecompressionStream("gzip"));

            const decompressed = await new Response(stream).arrayBuffer();

            const decoded = new TextDecoder().decode(decompressed);

            const projectData = ProjectLoader.deserialize(JSON.parse(decoded));

            const editorLayerIndex = System.world.getLayers().findIndex(l => l instanceof EditorLayer);
            const editorLayer = System.world.getLayers()[editorLayerIndex]!;
            System.world.removeLayer(editorLayer, false);

            await ProjectLoader.load(projectData);

            if (editorLayer) {
                System.world.unshiftLayer(editorLayer);
                System.world.sortLayers();
            }
            else {
                System.world.addLayer(new EditorLayer());
            }

            await Metadata.loadFromFile();

            return true;
        } catch (e) {
            console.log("could not load the project:", e);
            return false;
        }
    }

    private static async startupProject(handle: FileSystemDirectoryHandle): Promise<boolean> {
        System.fileSystem.setRootHandle(handle);
        const wasCreated = await ProjectConfig.ensureLoaded();

        await Project.getAllTextFiles();

        if (!await System.fileSystem.dirExists("flint")) {
            Editor.loadingDialogProgressBar.value = 0;
            Editor.loadingDialogProgressBar.indeterminate = false;
            Editor.loadingDialog.show();
            await Project.copyTypesToProject(window.location.href.replace(/index\.html$/, "") + "/types/", (total, loaded) => {
                Editor.loadingDialogProgressBar.value = (loaded / total) * 100;
            });
        }
        await System.fileSystem.createDir("assets");

        await Builder.buildForEditor();

        Editor.loadingDialog.hide();

        // await FileTracker.startWatchingDirectory();
        return wasCreated;
    }

    public static async getAllTextFiles(path = "") {
        const files: { path: string }[] = [];
        const assets: { id: string, name: string, type: string, path: string }[] = [];

        async function traverse(currentPath: string) {
            let entries: string[] = [];
            try {
                entries = await System.fileSystem.listDir(currentPath);
            } catch {
                // If FS doesn't support listDir, just returning
                return;
            }

            for (const name of entries) {
                const fullPath = currentPath ? `${currentPath}/${name}` : name;
                const isDir = await System.fileSystem.listDir(fullPath).then(() => true).catch(() => false);

                if (isDir) {
                    // Adding folder
                    assets.push({
                        id: crypto.randomUUID(),
                        name,
                        type: "folder",
                        path: "/" + fullPath
                    });
                    await traverse(fullPath);
                } else if (name.endsWith(".ts") || name.endsWith(".json")) {
                    // Adding file
                    // console.log(fullPath);
                    assets.push({
                        id: crypto.randomUUID(),
                        name,
                        type: name.endsWith(".ts") ? "component" : "json",
                        path: "/" + fullPath
                    });
                    files.push({ path: fullPath });
                }
            }
        }

        await traverse(path);

        return { files, assets };
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
        name = ComponentBuilder.joinToPascalCase(name);
        const fileBaseName = ComponentBuilder.splitPascalCase(name, "-");

        const assetPath = Editor.assetsWindow.currentPath.replace(/^\//, "");
        const relativeFilePath = `${assetPath}/${fileBaseName}.ts`;

        const fileContent = `import Component from "@flint/runtime/component";

export class ${name} extends Component {
    override start(): void {
        // Code that should run once on start
    }

    override update(): void {
        // Code that should run every frame
    }
}
`;

        const parts = assetPath.split("/").filter(Boolean);
        let currentPath = "";
        for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            const exists = await System.fileSystem.fileExists(currentPath);
            if (!exists) {
                await System.fileSystem.createDir(currentPath);
            }
        }

        await System.fileSystem.writeTextFile(relativeFilePath, fileContent);

        Editor.assetsWindow.addAsset({
            id: crypto.randomUUID(),
            name: fileBaseName + ".ts",
            type: "component",
            path: relativeFilePath,
            data: name
        });

        ProjectConfig.config.components.push({ name, file: "/" + relativeFilePath });
        await ProjectConfig.save();

        await Project.openInFileEditor("/" + relativeFilePath);
    }


    public static async deleteComponent(name: string) {
        const fileBaseName = ComponentBuilder.splitPascalCase(name, "-");
        const assetPath = Editor.assetsWindow.currentPath.replace(/^\//, "");
        const relativeFilePath = `${assetPath}/${fileBaseName}.ts`;

        try {
            const exists = await System.fileSystem.fileExists(relativeFilePath);
            if (exists) {
                await System.fileSystem.delete(relativeFilePath);
            } else {
                console.warn("File does not exist:", relativeFilePath);
            }
        } catch (e) {
            console.error("Failed to delete file:", e);
        }

        // Deleting component from config
        const index = ProjectConfig.config.components.findIndex(c => c.name === name);
        if (index !== -1) {
            ProjectConfig.config.components.splice(index, 1);
            await ProjectConfig.save();
        }

        // Updating UI
        Editor.assetsWindow.removeAsset(relativeFilePath);
    }


    private static async copyTypesToProject(
        typesBaseUrl: string,
        callback?: (total: number, loaded: number) => void
    ) {
        const fileList = await fetch(typesBaseUrl + "files.json").then(r => r.json());

        const allFiles: string[] = [
            ...(fileList.types || []),
            ...(fileList.json || [])
        ];

        let loaded = 0;

        const tasks = allFiles.map(async (filePath) => {
            const url = filePath.endsWith("d.ts")
                ? typesBaseUrl + filePath
                : typesBaseUrl.replace("types/", "src/") + filePath;

            const content = await fetch(url).then(r => r.text());

            const pathParts = filePath.split("/");
            const fileName = pathParts.pop()!;
            const dirPath = [...pathParts].filter(Boolean).join("/");

            if (dirPath) {
                await System.fileSystem.createDir(dirPath); // create intermediate directories
            }

            await System.fileSystem.writeTextFile(
                dirPath ? `${dirPath}/${fileName}` : fileName,
                content
            );

            if (callback) callback(allFiles.length, ++loaded);
        });

        await Promise.all(tasks);
        console.log("All type/json files copied!");
    }
}