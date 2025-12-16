import Editor from "../editor";
import ProjectConfig from "./project-config";
import { ComponentBuilder } from "../component-builder";
import { Builder } from "./builder";
import { System, type UUID } from "../../runtime/system";
import Metadata from "../../shared/metadata";
import { ProjectLoader } from "../../runtime/project-loader";
import { AbstractFileSystem as AbstractFileSystem } from "../../shared/file-system";

export class FileTracker {
    private constructor() { }

    static fileHashes = new Map<string, string>();
    static intervalId: number | null = null;

    private static debounceTimer: number | null = null;
    private static debounceDelay = 200; // auto adjustable

    static async startWatchingDirectory(path = "") {
        if (this.intervalId !== null) return;

        this.intervalId = setInterval(async () => {
            const updated = await this.directoryWasUpdated(path);
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
        if (this.debounceTimer !== null) {
            clearTimeout(this.debounceTimer);
        }

        this.debounceTimer = setTimeout(async () => {
            const start = performance.now();
            await Builder.buildForEditor(false);
            const end = performance.now();

            FileTracker.debounceDelay = end - start;
            this.stopWatching();
            await this.startWatchingDirectory("");

            this.debounceTimer = null;
        }, this.debounceDelay);
    }

    private static async directoryWasUpdated(currentPath: string): Promise<boolean> {
        let anyUpdated = false;
        let entries: string[];

        try {
            entries = await System.fileSystem.listDir(currentPath);
        } catch {
            // If FS desn`t support listDir
            return false;
        }

        for (const name of entries) {
            const fullPath = currentPath ? `${currentPath}/${name}` : name;

            const isDir = await System.fileSystem.listDir(fullPath).then(() => true).catch(() => false);

            if (isDir) {
                const subUpdated = await this.directoryWasUpdated(fullPath);
                if (subUpdated) anyUpdated = true;

                // Adding folder to tracker
                continue;
            }

            if (name === "metadata.json") continue;

            const updated = await this.wasUpdated(fullPath);
            if (updated) anyUpdated = true;
        }

        return anyUpdated;
    }

    private static async wasUpdated(path: string): Promise<boolean> {
        try {
            const data = await System.fileSystem.readFile(path);
            const hash = await this.hashData(data);
            const prevHash = this.fileHashes.get(path);

            this.fileHashes.set(path, hash);

            return prevHash !== undefined && prevHash !== hash;
        } catch {
            return false; // File doesn`t exist or couldn`t read it
        }
    }

    private static async hashData(data: Uint8Array): Promise<string> {
        const hashBuffer = await crypto.subtle.digest("SHA-1", AbstractFileSystem.toArrayBuffer(data));
        return Array.from(new Uint8Array(hashBuffer))
            .map(b => b.toString(16).padStart(2, "0"))
            .join("");
    }
}



export class Project {
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
        const arrayBuffer = await compressed.arrayBuffer();

        await System.fileSystem.writeFile(
            "project.gz",
            new Uint8Array(arrayBuffer)
        );
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

            const projectData = ProjectLoader.deserialize(decoded);

            ProjectLoader.load(projectData);
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

        try {
            await handle.getDirectoryHandle("flint");
        } catch {
            Editor.loadingDialogProgressBar.value = 0;
            Editor.loadingDialogProgressBar.indeterminate = false;
            Editor.loadingDialog.show();
            await Project.copyTypesToDirectory(handle, window.location.href.replace(/index\.html$/, "") + "/types/", (total, loaded) => {
                Editor.loadingDialogProgressBar.value = (loaded / total) * 100;
            });
        }

        await Metadata.loadFromFile();
        await Metadata.saveToFile();

        await Builder.buildForEditor();

        Editor.loadingDialog.hide();

        await FileTracker.startWatchingDirectory();
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
    start() {
        // Code that should run once on start
    }

    update() {
        // Code that should run every frame
    }
}
`;

        const parts = assetPath.split("/").filter(Boolean);
        let currentPath = "";
        for (const part of parts) {
            currentPath = currentPath ? `${currentPath}/${part}` : part;
            const exists = await System.fileSystem.exists(currentPath);
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

        ProjectConfig.config.components.push({ name, file: relativeFilePath });
        await ProjectConfig.save();

        await Project.openInFileEditor("/" + relativeFilePath);
    }


    public static async deleteComponent(name: string) {
        const fileBaseName = ComponentBuilder.splitPascalCase(name, "-");
        const assetPath = Editor.assetsWindow.currentPath.replace(/^\//, "");
        const relativeFilePath = `${assetPath}/${fileBaseName}.ts`;

        try {
            const exists = await System.fileSystem.exists(relativeFilePath);
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