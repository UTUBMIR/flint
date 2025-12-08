import { type UUID } from "../../runtime/system";
export declare class FileTracker {
    private constructor();
    static timestamps: Map<string, number>;
    static intervalId: number | null;
    private static debounceTimer;
    private static debounceDelay;
    static startWatchingDirectory(dirHandle: FileSystemDirectoryHandle): Promise<void>;
    static stopWatching(): void;
    private static scheduleRebuild;
    private static directoryWasUpdated;
    private static wasUpdated;
}
export declare class Project {
    static folderHandle: FileSystemDirectoryHandle;
    private static createComponentDialog;
    private static createComponentButton;
    private static createComponentInput;
    static names: Map<UUID, string>;
    private constructor();
    static run(): Promise<boolean>;
    static stop(): Promise<boolean>;
    static openProject(folderHandle: FileSystemDirectoryHandle): Promise<void>;
    static newProject(folderHandle: FileSystemDirectoryHandle): Promise<void>;
    static buildAndRun(): Promise<boolean>;
    static saveProject(): Promise<void>;
    private static loadProject;
    private static startupProject;
    static getAllTextFiles(dirHandle: FileSystemDirectoryHandle, path?: string): Promise<{
        files: {
            fileHandle: FileSystemFileHandle;
            path: string;
        }[];
        assets: {
            id: string;
            name: string;
            type: string;
            path: string;
        }[];
    }>;
    static openInFileEditor(path: string): Promise<void>;
    static showCreateComponentWindow(): void;
    static createComponent(name: string): Promise<void>;
    static deleteComponent(name: string): Promise<void>;
    private static copyTypesToDirectory;
}
