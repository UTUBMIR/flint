import Editor from "../editor";
import ProjectConfig from "./project-config";
import { ComponentBuilder } from "../component-builder";
import { Builder } from "./builder";

export class FileTracker {
    private constructor() { }

    static timestamps = new Map<string, number>();
    static intervalId: number | null = null;

    private static debounceTimer: number | null = null;
    private static debounceDelay = 50; // auto adjustable

    static async startWatchingDirectory(
        dirHandle: FileSystemDirectoryHandle,
        intervalMs: number = 200
    ) {
        if (this.intervalId !== null) return;

        this.intervalId = setInterval(async () => {
            const updated = await this.directoryWasUpdated(dirHandle);
            if (updated) {
                this.scheduleRebuild();
            }
        }, intervalMs);
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
        return await Builder.buildForEditor();
    }

    public static async openProject(folderHandle: FileSystemDirectoryHandle) {
        await Project.startupProject(folderHandle);
    }

    public static async newProject(folderHandle: FileSystemDirectoryHandle) {
        await Project.startupProject(folderHandle);
    }

    private static async startupProject(folderHandle: FileSystemDirectoryHandle) {
        Project.folderHandle = folderHandle;
        await ProjectConfig.ensureLoaded();
        await Project.getAllTextFiles(Project.folderHandle);

        await Builder.buildForEditor();

        await FileTracker.startWatchingDirectory(Project.folderHandle);
    }

    public static async getAllTextFiles(dirHandle: FileSystemDirectoryHandle, path = "") {
        const files: { fileHandle: FileSystemFileHandle, path: string }[] = [];
        const assets: {id: string, name: string, type: string, path: string}[] = [];

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

        return {files, assets};
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

        const depth = assetPath.split("/").filter(Boolean).length;
        const importPrefix = "../".repeat(depth);
        const importPath = `${importPrefix}flint/runtime/component`;

        const fileContent = `import Component from "${importPath}";

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
            path: relativeFilePath
        });

        ProjectConfig.config.index += `\nexport * from "./${relativeFilePath.replace(/\.ts$/, "")}";`;
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

        // Remove export from index
        const exportLine = `export * from "./${relativeFilePath.replace(/\.ts$/, "")}";`;
        ProjectConfig.config.index = ProjectConfig.config.index
            .split("\n")
            .filter(line => line.trim() !== exportLine)
            .join("\n");

        await ProjectConfig.save();

        Editor.assetsWindow.removeAsset(relativeFilePath);
    }
}