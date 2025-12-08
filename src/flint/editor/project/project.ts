import Editor from "../editor";
import ProjectConfig from "./project-config";
import { ComponentBuilder } from "../component-builder";
import { Builder } from "./builder";
import { System, type UUID } from "../../runtime/system";
import Metadata from "../../shared/metadata";
import { ProjectLoader } from "../../runtime/project-loader";

export class FileTracker {
    private constructor() { }

    static timestamps = new Map<string, number>();
    static intervalId: number | null = null;

    private static debounceTimer: number | null = null;
    private static debounceDelay = 200; // auto adjustable

    static async startWatchingDirectory(
        dirHandle: FileSystemDirectoryHandle
    ) {
        if (this.intervalId !== null) return;

        this.intervalId = setInterval(async () => {
            const updated = await this.directoryWasUpdated(dirHandle);
            if (updated) {
                this.scheduleRebuild();
            }
        }, this.debounceDelay);
    }

    static stopWatching() {
        if (this.intervalId !== null) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }

        if (this.debounceTimer !== null) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
    }

    private static scheduleRebuild() {
        /* If timer already started -> stop it and start a new one */
        if (this.debounceTimer !== null) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(async () => {
            const start = performance.now();
            await Builder.buildForEditor(false);
            const end = performance.now();

            FileTracker.debounceDelay = end - start;
            this.stopWatching();
            this.startWatchingDirectory(Project.folderHandle);

            this.debounceTimer = null;
        }, this.debounceDelay);
    }

    private static async directoryWasUpdated(
        dirHandle: FileSystemDirectoryHandle,
        currentPath = ""
    ) {
        let anyUpdated = false;

        for await (const entry of dirHandle.values()) {
            const fullPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

            if (entry.kind === "file") {
                if (fullPath.endsWith("metadata.json")) continue; // dont react on metadata updates

                const fileUpdated = await this.wasUpdated(fullPath, entry);
                if (fileUpdated) anyUpdated = true;
            }

            if (entry.kind === "directory") {
                const subUpdated = await this.directoryWasUpdated(entry, fullPath);
                if (subUpdated) anyUpdated = true;
            }
        }

        return anyUpdated;
    }

    private static async wasUpdated(path: string, fileHandle: FileSystemFileHandle) {
        const file = await fileHandle.getFile();
        const newTimestamp = file.lastModified;
        const prevTimestamp = this.timestamps.get(path);

        this.timestamps.set(path, newTimestamp);

        return prevTimestamp !== undefined && prevTimestamp !== newTimestamp;
    }
}


export class Project {
    public static folderHandle: FileSystemDirectoryHandle;

    private static createComponentDialog: HTMLElement & { show: () => void; hide: () => void };
    private static createComponentButton: HTMLButtonElement;
    private static createComponentInput: HTMLInputElement;

    public static names: Map<UUID, string> = new Map();

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

    public static async run() {
        await Project.saveProject();
        return await Builder.buildForEditor();
    }

    public static async stop() {
        const success = await Project.loadProject();
        Editor.hierarchyWindow.onUpdate();

        if (Editor.inspectorWindow.currentObject) {
            Editor.inspectorWindow.currentObject = System.getGameObjectById(Editor.inspectorWindow.currentObject.uuid);
        }
        return success;
    }

    public static async openProject(folderHandle: FileSystemDirectoryHandle) {
        await Project.startupProject(folderHandle);
        await Project.loadProject();
        Editor.hierarchyWindow.onUpdate();

        setInterval(async () => {
            await Project.saveProject();
        }, 60000); // FIXME: implement autosave in a better way
    }

    public static async newProject(folderHandle: FileSystemDirectoryHandle) {
        if (await Project.startupProject(folderHandle) || !await Project.loadProject()) {
            System.pushLayer(Editor.defaultLayer);
            Editor.hierarchyWindow.onUpdate();
        }

        await Project.saveProject();
        Editor.hierarchyWindow.onUpdate();

        setInterval(async () => {
            await Project.saveProject();
        }, 60000); // FIXME: implement autosave in a better way
    }

    public static async buildAndRun() {
        return await Builder.build();
    }

    public static async saveProject() {
        const data = ProjectLoader.serialize({ layers: System.layers });
        const blob = new Blob([data], { type: "text/plain" });
        const cs = new CompressionStream("gzip");
        const compressed = new Response(blob.stream().pipeThrough(cs));
        const fileHandle = await Project.folderHandle.getFileHandle("project.gz", { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(await compressed.arrayBuffer());
        await writable.close();
    }

    private static async loadProject() {
        try {
            const fileHandle = await Project.folderHandle.getFileHandle("project.gz");
            const file = await fileHandle.getFile();
            const ds = new DecompressionStream("gzip");
            const decompressed = await new Response(file.stream().pipeThrough(ds)).arrayBuffer();
            const decoded = new TextDecoder().decode(decompressed);
            const projectData = ProjectLoader.deserialize(decoded);

            System.layers.length = 0;
            for (const layer of projectData.layers) System.pushLayer(layer);
            return true;
        } catch (e) {
            console.log("could not load the project:", e);
            return false;
        }
    }

    private static async startupProject(folderHandle: FileSystemDirectoryHandle): Promise<boolean> {
        Project.folderHandle = folderHandle;
        const wasCreated = await ProjectConfig.ensureLoaded();

        await Project.getAllTextFiles(Project.folderHandle);

        if (wasCreated) {
            Editor.loadingDialogProgressBar.value = 0;
            Editor.loadingDialogProgressBar.indeterminate = false;
            Editor.loadingDialog.show();

            await Project.copyTypesToDirectory(folderHandle, window.location.origin + "/types/", (total, loaded) => {
                Editor.loadingDialogProgressBar.value = (loaded / total) * 100;
            });
        }

        await Metadata.loadFromFile(Project.folderHandle);
        await Metadata.saveToFile(Project.folderHandle);

        await Builder.buildForEditor();

        Editor.loadingDialog.hide();

        await FileTracker.startWatchingDirectory(Project.folderHandle);
        return wasCreated;
    }

    public static async getAllTextFiles(dirHandle: FileSystemDirectoryHandle, path = "") {
        const files: { fileHandle: FileSystemFileHandle, path: string }[] = [];
        const assets: { id: string, name: string, type: string, path: string }[] = [];

        for await (const [name, handle] of dirHandle.entries()) {
            if (handle.kind === "file" && (name.endsWith(".ts") || name.endsWith(".json"))) {
                assets.push({
                    id: crypto.randomUUID(),
                    name,
                    type: name.split(".").pop() === "ts" ? "component" : "json",
                    path: "/" + path + name
                });

                files.push({ fileHandle: handle, path: path + name });
            } else if (handle.kind === "directory") {
                assets.push({
                    id: crypto.randomUUID(),
                    name,
                    type: "folder",
                    path: "/" + path + name
                });

                const nestedFiles = (await Project.getAllTextFiles(handle, path + name + "/")).files;
                files.push(...nestedFiles);
            }
        }

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
        name = ComponentBuilder.joinToPascalCase(name); // just ensure that name is correct
        const fileBaseName = ComponentBuilder.splitPascalCase(name, "-");

        const assetPath = Editor.assetsWindow.currentPath.replace(/^\//, "");
        const relativeFilePath = `${assetPath}/${fileBaseName}.ts`;

        const fileContent = `import Component from "@flint/runtime/component";

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
            path: relativeFilePath,
            data: name
        });

        ProjectConfig.config.components.push({ name, file: relativeFilePath });

        await ProjectConfig.save();

        await Project.openInFileEditor("/" + relativeFilePath);
    }


    public static async deleteComponent(name: string) {
        const fileBaseName = ComponentBuilder.splitPascalCase(name, "-");
        const assetPath = Editor.assetsWindow.currentPath.replace(/^\//, "");
        const relativeFilePath = `${assetPath}/${fileBaseName}.ts`;

        let folderHandle = Project.folderHandle;
        const parts = assetPath.split("/").filter(Boolean);
        for (const part of parts) {
            folderHandle = await folderHandle.getDirectoryHandle(part, { create: false });
            if (!folderHandle) return; // folder doesn't exist
        }

        try {
            await folderHandle.removeEntry(fileBaseName + ".ts");
        } catch (e) {
            console.warn("File not found:", e);
        }

        ProjectConfig.config.components.splice(ProjectConfig.config.components.findIndex(c => c.name === name), 1);

        await ProjectConfig.save();

        Editor.assetsWindow.removeAsset(relativeFilePath);
    }

    private static async copyTypesToDirectory(
        dirHandle: FileSystemDirectoryHandle,
        typesBaseUrl: string,
        callback?: (total: number, loaded: number) => void
    ) {
        const fileList = await fetch(typesBaseUrl + "files.json").then(r => r.json());

        const allFiles: string[] = [
            ...(fileList.types || []),
            ...(fileList.json || [])
        ];

        const tasks: Promise<void>[] = [];
        let loaded = 0;

        for (const filePath of allFiles) {
            tasks.push((async () => {
                const url = typesBaseUrl + filePath;

                let response: Response;
                if (filePath.endsWith("d.ts")) {
                    response = await fetch(url);
                } else {
                    response = await fetch(typesBaseUrl.replace("types/", "src/") + filePath);
                }


                const content = await response.text();

                const pathParts = filePath.split("/");
                const fileName = pathParts.pop()!;
                let currentDir = dirHandle;

                for (const folder of pathParts) {
                    currentDir = await currentDir.getDirectoryHandle(folder, { create: true });
                }

                const fileHandle = await currentDir.getFileHandle(fileName, { create: true });
                const writable = await fileHandle.createWritable();
                await writable.write(content);
                await writable.close();

                if (callback) callback(allFiles.length, ++loaded);
            })());
        }

        await Promise.all(tasks);
        console.log("All type/json files copied!");
    }
}