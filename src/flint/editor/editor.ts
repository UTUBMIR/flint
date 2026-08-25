import GameObject from "@flint/runtime/game-object";
import Layer from "@flint/runtime/layer";
import Vector2 from "@flint/shared/vector2";
import { engineSrcFiles, editorSrcFiles } from "../engine-files";
import { defaultProjectComponents, defaultProjectData, defaultProjectFiles } from "@flint/build";
import Bundler from "./project/bundler";
import { normalizeAssetUrl } from "./project/asset-paths";
import { Project } from "./project/project";
import type HierarchyWindow from "./windows/hierarchy";
import { EditorName as EditorName } from "./windows/hierarchy";

import Transform from "@flint/runtime/transform";
import { System } from "@flint/runtime/system";
import { Builder } from "./project/builder";
import * as Physics from "@flint/runtime/components/physics-index";
import * as Components from "@flint/runtime/components/index";
import type Component from "@flint/runtime/component";
import { CodeEditor } from "./ui/code-editor";
import { SettingsWindow, type SettingsChangedEventDetail, type SettingsValue } from "./settings/settings-window";
import type SlDialog from "@shoelace-style/shoelace/dist/components/dialog/dialog.component.js";
import type SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js";
import type SlCheckbox from "@shoelace-style/shoelace/dist/components/checkbox/checkbox.component.js";
import type SlInput from "@shoelace-style/shoelace/dist/components/input/input.component.js";
import type SlSelect from "@shoelace-style/shoelace/dist/components/select/select.component.js";
import type SlCopyButton from "@shoelace-style/shoelace/dist/components/copy-button/copy-button.component.js";
import ProjectConfig from "./project/project-config";
import { AbstractFileSystem } from "@flint/shared/file-system";
import { AssetRegistry, AssetType } from "@flint/runtime/assets";
import { activeWindowService, editorAssetStore } from "./ui/window-services";
import { ProjectLoader, type ProjectData } from "@flint/runtime/project-loader";
import { RecentProjectsAccess } from "./recent-projects";

import { refreshEditorWindows, resetEditorLayout, spawnEditorWindow, getEditorWindowsOfType } from "./layout";
import { Notifier } from "./notifier";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";
import { PreviewServer } from "./live-preview/preview-server";
import { RuntimeErrorCapture } from "./diagnostics/runtime-error-capture";
import { ProblemsStore } from "./diagnostics/problems-store";
import { openProblemsReport } from "./diagnostics/problems-report";

export type ProjectTemplateFile = {
    path: string;
    content: string;
};

export type ProjectTemplateComponent = {
    name: string;
    file: string;
};

export type ProjectTemplate = {
    data: ProjectData;
    files: ProjectTemplateFile[];
    components: ProjectTemplateComponent[];
};

export type DropdownType = HTMLElement & {
    show: () => void;
    hide: () => void;
    reposition: () => void;
};

export type ProcessVariant = "neutral" | "primary" | "success" | "warning" | "danger";

export type ProcessActions = {
    update: (message: string) => void;
    complete: (message?: string) => void;
    fail: (message: string) => void;
    remove: () => void;
};

export class ProcessIndicator {
    private static container: HTMLElement;
    private static wrapper: HTMLElement | null = null;
    private static tag: HTMLElement & { variant?: string } | null = null;
    private static spinner: HTMLElement | null = null;
    private static processes: Map<string, { message: string; variant: ProcessVariant }> = new Map();
    private static hideTimeout: number | null = null;

    public static init() {
        ProcessIndicator.container = document.getElementById("process-indicator")!;
        ProcessIndicator.wrapper = ProcessIndicator.container.querySelector(".process-item") as HTMLElement | null;
        ProcessIndicator.tag = ProcessIndicator.wrapper?.querySelector("sl-tag") as HTMLElement & { variant?: string } | null;
        ProcessIndicator.spinner = ProcessIndicator.wrapper?.querySelector("sl-spinner") as HTMLElement | null;
    }

    public static startProcess(message: string, variant: ProcessVariant = "neutral"): ProcessActions {
        if (ProcessIndicator.hideTimeout) {
            clearTimeout(ProcessIndicator.hideTimeout);
            ProcessIndicator._hideTag();
        }

        for (const [id, process] of ProcessIndicator.processes) {
            if (process.variant === "success" || process.variant === "danger") {
                ProcessIndicator.processes.delete(id);
            }
        }

        const id = crypto.randomUUID();
        ProcessIndicator.processes.set(id, { message, variant });
        ProcessIndicator._render(true);

        return ProcessIndicator._createActions(id);
    }

    private static _createActions(id: string): ProcessActions {
        return {
            update: (message: string) => {
                const process = ProcessIndicator.processes.get(id);
                if (process) {
                    process.message = message;
                    ProcessIndicator._render();
                }
            },
            complete: (message?: string) => {
                const process = ProcessIndicator.processes.get(id);
                if (process) {
                    process.message = message ?? process.message;
                    process.variant = "success";
                    ProcessIndicator._render();
                    setTimeout(() => {
                        ProcessIndicator.processes.delete(id);
                        ProcessIndicator._render();
                    }, 3000);
                }
            },
            fail: (message: string) => {
                const process = ProcessIndicator.processes.get(id);
                if (process) {
                    process.message = message;
                    process.variant = "danger";
                    ProcessIndicator._render();
                    setTimeout(() => {
                        ProcessIndicator.processes.delete(id);
                        ProcessIndicator._render();
                    }, 5000);
                }
            },
            remove: () => {
                ProcessIndicator.processes.delete(id);
                ProcessIndicator._render();
            }
        };
    }

    private static _render(immediate = false) {
        const firstProcess = ProcessIndicator.processes.values().next().value;

        if (firstProcess && ProcessIndicator.tag && ProcessIndicator.spinner) {
            ProcessIndicator.tag.innerHTML = firstProcess.message;
            ProcessIndicator.tag.variant = firstProcess.variant;
            ProcessIndicator.spinner.style.display = firstProcess.variant === "success" || firstProcess.variant === "danger" ? "none" : "";
            ProcessIndicator.wrapper!.style.display = "";
            if (ProcessIndicator.hideTimeout) {
                clearTimeout(ProcessIndicator.hideTimeout);
                ProcessIndicator.hideTimeout = null;
            }
        } else if (ProcessIndicator.tag && ProcessIndicator.spinner) {
            ProcessIndicator.spinner.style.display = "none";
            if (immediate || ProcessIndicator.processes.size === 0) {
                ProcessIndicator._hideTag();
            } else {
                if (ProcessIndicator.hideTimeout) {
                    clearTimeout(ProcessIndicator.hideTimeout);
                }
                ProcessIndicator.hideTimeout = setTimeout(() => {
                    ProcessIndicator._hideTag();
                }, 200);
            }
        }
    }

    private static _hideTag() {
        if (ProcessIndicator.wrapper) {
            ProcessIndicator.wrapper.style.display = "none";
        }
        ProcessIndicator.hideTimeout = null;
    }

    public static clearAll() {
        ProcessIndicator.processes.clear();
        ProcessIndicator._render();
    }
}

class ToolBarActions {
    private constructor() { }

    private static getPicker() {
        if ("showDirectoryPicker" in window) {
            return window.showDirectoryPicker({ mode: "readwrite", id: "project" });
        }
        else {
            Notifier.notify("Your browser does not support the File System Access API. Projects will be stored in private in-browser storage.", "warning");
            return navigator.storage.getDirectory();
        }
    }

    public static async pickProjectDirectory(): Promise<FileSystemDirectoryHandle> {
        return ToolBarActions.getPicker();
    }

    public static async newProject() {
        if (Project.needsSave()) {
            const choice = await UnsavedChangesDialog.show();
            if (choice === "cancel") {
                return;
            }
            if (choice === "save") {
                await Project.saveProject();
            }
        }

        const handle = await ToolBarActions.getPicker();
        await Project.newProject(handle);
        await RecentProjectsAccess.storeHandle(handle);
        Editor.onProjectLoad();
        Editor.loadRecentProjects();
        Editor.loadRecentProjectsMenu();
        Notifier.notify("Project created successfully.", "success");
    }

    public static async openProject() {
        if (Project.needsSave()) {
            const choice = await UnsavedChangesDialog.show();
            if (choice === "cancel") {
                return;
            }
            if (choice === "save") {
                await Project.saveProject();
            }
        }

        const handle = await ToolBarActions.getPicker();
        await Project.openProject(handle);
        await RecentProjectsAccess.storeHandle(handle);
        Editor.onProjectLoad();
        Editor.loadRecentProjects();
        Editor.loadRecentProjectsMenu();
        Notifier.notify("Project loaded successfully.", "success");
    }

    public static async saveProject() {
        try {
            await Project.saveProject();
            Notifier.notify("Project saved successfully.", "success");
        }
        catch (e: unknown) {
            Notifier.notify("Could not save the project: " + e, "warning");
        }
    }

    private static async pickArchiveFile() {
        return await new Promise<File | null>((resolve) => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".gz,application/gzip";

            input.addEventListener("change", () => {
                resolve(input.files?.[0] ?? null);
            }, { once: true });

            input.click();
        });
    }

    public static async exportProjectArchive() {
        try {
            const compressed = await Project.exportProjectArchive();
            const blob = new Blob([AbstractFileSystem.toArrayBuffer(compressed)], { type: "application/gzip" });
            const fileName = `flint-project-${new Date().toISOString().slice(0, 10)}.gz`;
            const url = URL.createObjectURL(blob);

            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = fileName;
            anchor.click();

            URL.revokeObjectURL(url);
            Notifier.notify("Project archive exported.", "success");
        }
        catch (e: unknown) {
            Notifier.notify("Could not export project archive: " + e, "warning");
        }
    }

    public static async downloadtBuild() {
        try {
            const build = await System.fileSystem.readTextFile("build/index.html");
            const blob = new Blob([build], { type: "text/html" });
            const fileName = "index.html";
            const url = URL.createObjectURL(blob);

            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = fileName;
            anchor.click();

            URL.revokeObjectURL(url);
            Notifier.notify("Build downloaded", "success");
        }
        catch (e: unknown) {
            Notifier.notify("Could not download build: " + e, "warning");
        }
    }

    public static async importProjectArchive() {
        try {
            const file = await ToolBarActions.pickArchiveFile();
            if (!file) {
                return;
            }

            const bytes = new Uint8Array(await file.arrayBuffer());
            await Project.importProjectArchive(bytes);
            Editor.onProjectLoad();
            Notifier.notify("Project archive imported.", "success");
        }
        catch (e: unknown) {
            Notifier.notify("Could not import project archive: " + e, "warning");
        }
    }

    public static async buildAndRun() {
        await Project.saveProject();
        if (await Project.buildAndRun()) {
            // Notifier.notify("Project builded successfully.", "success");
        }
    }

    public static async compile() {
        try {
            await Builder.buildForEditor(true);
        }
        catch (e: unknown) {
            Notifier.notify("Could not compile the project: " + e, "warning");
        }

    }

    public static async runProject() {
        const start = Editor.runButtonIcon.name === "play";
        Editor.runButtonIcon.name = start ? "stop" : "play";

        if (start) {
            if (await Project.run()) {
                ProblemsStore.clearRuntimeErrors();
                System.run();
                // Notifier.notify("Project started.", "primary");
            }
        }
        else {
            System.runRenderingOnly();
            if (await Project.stop()) {
                // Notifier.notify("Project stopped.", "primary");
            }
        }
    }

    public static resetLayout() {
        resetEditorLayout();
        Notifier.notify("Layout reset to defaults.", "success");
    }
}


export default class Editor {
    public static draggedItem: unknown | undefined;

    public static settingsWindow: SettingsWindow;
    public static qrPreviewWindow: PreviewServer;

    public static runButton: HTMLButtonElement;
    public static runButtonIcon: { name: string };

    public static loadingDialog: HTMLElement & { show: () => void, hide: () => void };
    public static loadingDialogProgressBar: HTMLElement & { value: number, indeterminate: boolean };

    public static welcomePanel: HTMLElement & { show: () => void, hide: () => void };
    public static welcomePanelNewBtn: SlButton;
    public static welcomePanelOpenBtn: SlButton;
    public static welcomePanelRecentList: HTMLElement;

    public static get defaultProject(): ProjectTemplate {
        return this.createDefaultProject();
    }

    private static _running = false;
    private static _resolveEngineFilesReady: () => void;
    public static engineFilesReady: Promise<void>;

    public static get running(): boolean {
        return this._running;
    }

    static {
        Editor.engineFilesReady = new Promise<void>((resolve) => {
            Editor._resolveEngineFilesReady = resolve;
        });
    }

    private constructor() { }

    private static readonly settingsMapping: Record<string, {
        getValue: () => SettingsValue;
        setValue: (event: SettingsChangedEventDetail) => Promise<void>;
    }> = {
            "performance.physics.usePhysicsWorld": {
                getValue: () => ProjectConfig.config.usePhysics,
                setValue: async ({ value }) => {
                    ProjectConfig.config.usePhysics = value as boolean;
                    await ProjectConfig.save();
                }
            },
            "performance.physics.pixelsPerMeter": {
                getValue: () => ProjectConfig.config.physicsPixelsPerMeter,
                setValue: async ({ value }) => {
                    const numericValue = Number(value);
                    if (!Number.isFinite(numericValue) || numericValue <= 0) {
                        return;
                    }

                    ProjectConfig.config.physicsPixelsPerMeter = numericValue;
                    await ProjectConfig.save();
                }
            },
            "performance.physics.gravityX": {
                getValue: () => ProjectConfig.config.physicsGravityX,
                setValue: async ({ value }) => {
                    const numericValue = Number(value);
                    if (!Number.isFinite(numericValue)) {
                        return;
                    }

                    ProjectConfig.config.physicsGravityX = numericValue;
                    await ProjectConfig.save();
                }
            },
            "performance.physics.gravityY": {
                getValue: () => ProjectConfig.config.physicsGravityY,
                setValue: async ({ value }) => {
                    const numericValue = Number(value);
                    if (!Number.isFinite(numericValue)) {
                        return;
                    }

                    ProjectConfig.config.physicsGravityY = numericValue;
                    await ProjectConfig.save();
                }
            },
            "debugging.code.generateJsMap": {
                getValue: () => ProjectConfig.config.generateJsMap,
                setValue: async ({ value }) => {
                    ProjectConfig.config.generateJsMap = value as boolean;
                    await ProjectConfig.save();
                }
            },
            "performance.compilation.incrementalRebuilds": {
                getValue: () => ProjectConfig.config.incrementalRebuilds,
                setValue: async ({ value }) => {
                    ProjectConfig.config.incrementalRebuilds = value as boolean;
                    await ProjectConfig.save();
                }
            }
        };

    private static addBasicComponents() {
        for (const [name, component] of Object.entries(Physics)) {
            System.registerComponent(name, component as typeof Component);
        }

        for (const [name, component] of Object.entries(Components)) {
            System.registerComponent(name, component as typeof Component);
        }
    }

    private static enableLongPressContextMenu(element: EventTarget, delay = 400) {
        let timer: number | null = null;
        let startX = 0;
        let startY = 0;

        element.addEventListener("pointerdown", e => {
            if ((e as PointerEvent).button !== 0 || (e as PointerEvent).pointerType === "mouse") return;

            startX = (e as PointerEvent).clientX;
            startY = (e as PointerEvent).clientY;

            function contextMenu() {
                const contextEvent = new MouseEvent("contextmenu", {
                    bubbles: true,
                    cancelable: true,
                    clientX: startX,
                    clientY: startY,
                    button: 2
                });

                e.target?.dispatchEvent(contextEvent);
            }

            timer = setTimeout(() => {
                contextMenu();
                setTimeout(contextMenu, 350);
            }, delay);
        });

        element.addEventListener("pointerup", () => {
            clearTimeout(timer ?? 0);
        });

        element.addEventListener("pointercancel", () => {
            clearTimeout(timer ?? 0);
        });

        element.addEventListener("pointermove", e => {
            if (!timer) return;

            const dx = Math.abs((e as PointerEvent).clientX - startX);
            const dy = Math.abs((e as PointerEvent).clientY - startY);

            if (dx > 10 || dy > 10) {
                clearTimeout(timer);
            }
        });
    }

    private static initSettingsWindow() {
        Editor.settingsWindow.onSettingsChanged(async (event) => {
            const mapping = Editor.settingsMapping[event.path];
            if (!mapping) {
                console.error("Unexpected settings path: " + event.path);
                return;
            }

            await mapping.setValue(event);
        });
    }

    private static initAssetMenuActions() {
        const createAssetDialog = document.getElementById("create-asset-dialog")! as SlDialog;
        const createButton = createAssetDialog.querySelector("sl-button") as SlButton;
        const preloadCheckbox = createAssetDialog.querySelector("sl-checkbox") as SlCheckbox;
        const typeSelect = createAssetDialog.querySelector("sl-select")! as SlSelect;
        const createInput = createAssetDialog.querySelector("sl-input") as SlInput;

        if (!typeSelect.querySelector("sl-option")) {
            for (const type of Object.keys(AssetType).filter(key => Number.isNaN(Number(key)))) {
                typeSelect.append(Object.assign(document.createElement("sl-option"), {
                    textContent: type,
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    value: (AssetType as any)[type]
                }));
            }
            typeSelect.setAttribute("value", "0");
        }

        document.getElementById("new-asset-button")?.addEventListener("click", () => {
            createButton.disabled = true;
            createInput.value = "";
            createAssetDialog.show();
        });

        createInput.addEventListener("sl-input", () => {
            createButton.disabled = createInput.value.trim() === "";
        });

        createButton.addEventListener("click", () => {
            createAssetDialog.hide();
            AssetRegistry.register({
                id: crypto.randomUUID(),
                url: normalizeAssetUrl(createInput.value),
                type: +typeSelect.value,
                preload: preloadCheckbox.checked
            });
        });

        const viewAssetsDialog = document.getElementById("view-assets-dialog")! as SlDialog;
        const assetsTable = viewAssetsDialog.querySelector("table")! as HTMLTableElement;
        document.getElementById("view-assets-button")?.addEventListener("click", () => {
            Editor.fillAssetTable(assetsTable);
            viewAssetsDialog.show();
        });

        document.getElementById("new-component-general-button")?.addEventListener("click", () => {
            Project.showCreateComponentWindow();
        });

        document.getElementById("upload-file-button")?.addEventListener("click", () => {
            void Editor.uploadFileToActiveAssetsFolder();
        });
    }

    private static async initWelcomePanel() {
        Editor.welcomePanel = document.getElementById("welcome-panel")! as SlDialog;
        Editor.welcomePanelNewBtn = Editor.welcomePanel.querySelectorAll("sl-button")[0] as SlButton;
        Editor.welcomePanelOpenBtn = Editor.welcomePanel.querySelectorAll("sl-button")[1] as SlButton;
        Editor.welcomePanelRecentList = Editor.welcomePanel.querySelector(".recent-projects-list") as HTMLElement;

        Editor.welcomePanelNewBtn.addEventListener("click", async () => {
            Editor.welcomePanel.hide();
            await ToolBarActions.newProject();
            if (Project.folderHandle) {
                await RecentProjectsAccess.storeHandle(Project.folderHandle);
            }
            Editor.loadRecentProjects();
        });

        Editor.welcomePanelOpenBtn.addEventListener("click", async () => {
            Editor.welcomePanel.hide();
            await ToolBarActions.openProject();
            if (Project.folderHandle) {
                await RecentProjectsAccess.storeHandle(Project.folderHandle);
            }
            Editor.loadRecentProjects();
        });

        Editor.loadRecentProjects();

        Editor.welcomePanel.addEventListener("sl-request-close", function (event: any) {
            if (event.detail?.source === "overlay") {
                event.preventDefault();
            }
        });

        Editor.welcomePanel.show();
    }

    public static async loadRecentProjects() {
        const projects = await RecentProjectsAccess.getAll();
        Editor.welcomePanelRecentList.innerHTML = "";

        for (const project of projects) {
            const item = document.createElement("div");
            item.className = "recent-project-item";

            const icon = document.createElement("sl-icon");
            icon.setAttribute("name", "folder2-open");

            const name = document.createElement("span");
            name.className = "recent-project-name";
            name.textContent = project.name;

            const removeBtn = document.createElement("sl-icon-button");
            removeBtn.className = "recent-project-remove";
            removeBtn.setAttribute("name", "x-lg");
            removeBtn.setAttribute("label", "Remove from recent");
            removeBtn.addEventListener("click", async (e) => {
                e.stopPropagation();
                await RecentProjectsAccess.remove(project.id);
                Editor.loadRecentProjects();
                Editor.loadRecentProjectsMenu();
            });

            item.append(icon, name, removeBtn);

            item.addEventListener("click", async () => {
                if (Project.needsSave()) {
                    const choice = await UnsavedChangesDialog.show();
                    if (choice === "cancel") {
                        return;
                    }
                    if (choice === "save") {
                        await Project.saveProject();
                    }
                }

                const handle = await RecentProjectsAccess.openProject(project.id);
                if (handle) {
                    Editor.welcomePanel.hide();
                    await Project.openProject(handle);
                    Editor.onProjectLoad();
                    Editor.loadRecentProjects();
                    Editor.loadRecentProjectsMenu();
                } else {
                    Notifier.notify("Could not open project. Permission may have been revoked.", "warning");
                    await RecentProjectsAccess.remove(project.id);
                    Editor.loadRecentProjects();
                    Editor.loadRecentProjectsMenu();
                }
            });

            Editor.welcomePanelRecentList.append(item);
        }
    }

    public static async loadRecentProjectsMenu() {
        const menu = document.getElementById("recent-projects-menu");
        if (!menu) return;

        const projects = await RecentProjectsAccess.getAll();
        const currentProjectId = Project.folderHandle?.name;

        menu.innerHTML = "";

        if (projects.length === 0) {
            const item = document.createElement("sl-menu-item");
            item.setAttribute("disabled", "");
            item.textContent = "No recent projects";
            menu.append(item);
            return;
        }

        for (const project of projects) {
            const item = document.createElement("sl-menu-item");
            const isCurrent = project.id === currentProjectId;

            if (isCurrent) {
                item.innerHTML = `<sl-icon slot="prefix" name="folder2-open"></sl-icon>${project.name} <span style="opacity: 0.6; font-size: 0.85em; margin-left: 8px;">Current project</span>`;
                item.setAttribute("disabled", "");
            } else {
                item.innerHTML = `<sl-icon slot="prefix" name="folder2-open"></sl-icon>${project.name}`;
                item.addEventListener("click", async () => {
                    if (Project.needsSave()) {
                        const choice = await UnsavedChangesDialog.show();
                        if (choice === "cancel") {
                            return;
                        }
                        if (choice === "save") {
                            await Project.saveProject();
                        }
                    }

                    const handle = await RecentProjectsAccess.openProject(project.id);
                    if (handle) {
                        await Project.openProject(handle);
                        Editor.onProjectLoad();
                        Editor.loadRecentProjects();
                        Editor.loadRecentProjectsMenu();
                    } else {
                        Notifier.notify("Could not open project. Permission may have been revoked.", "warning");
                        await RecentProjectsAccess.remove(project.id);
                        Editor.loadRecentProjects();
                        Editor.loadRecentProjectsMenu();
                    }
                });
            }
            menu.append(item);
        }
    }

    private static fillAssetTable(table: HTMLTableElement) {
        const body = table.tBodies[0];
        if (!body) {
            throw new Error("Assets table must have a body.");
        }

        body.innerHTML = "";
        for (const asset of AssetRegistry.meta.values()) {
            const row = body.insertRow();
            row.insertCell().innerText = asset.url;
            const idCell = row.insertCell();
            idCell.style.display = "flex";

            const idCopyButton = document.createElement("sl-copy-button") as SlCopyButton;
            idCopyButton.value = asset.id;
            idCopyButton.style.marginLeft = "auto";
            idCell.append(document.createTextNode(asset.id), idCopyButton);

            row.insertCell().innerText = AssetType[asset.type];
            const checkbox = document.createElement("sl-checkbox") as SlCheckbox;
            checkbox.checked = asset.preload;
            checkbox.addEventListener("sl-change", () => {
                asset.preload = checkbox.checked;
                void Project.saveProject();
            });
            row.insertCell().append(checkbox);

            const actionsCell = row.insertCell();
            actionsCell.style.display = "flex";
            actionsCell.style.gap = "4px";

            const renameButton = document.createElement("sl-button") as SlButton;
            renameButton.size = "small";
            renameButton.textContent = "Rename";
            renameButton.addEventListener("click", () => {
                const newUrl = window.prompt("New asset url:", asset.url);
                if (newUrl === null || newUrl.trim() === "") {
                    return;
                }

                asset.url = normalizeAssetUrl(newUrl);
                void Project.saveProject().then(() => Editor.fillAssetTable(table));
            });

            const removeButton = document.createElement("sl-button") as SlButton;
            removeButton.size = "small";
            removeButton.variant = "danger";
            removeButton.textContent = "Remove";
            removeButton.addEventListener("click", () => {
                AssetRegistry.meta.delete(asset.id);
                void Project.saveProject().then(() => Editor.fillAssetTable(table));
            });

            actionsCell.append(renameButton, removeButton);
        }
    }

    private static async uploadFileToActiveAssetsFolder() {
        const file = await new Promise<File | null>(resolve => {
            const input = document.createElement("input");
            input.type = "file";
            input.addEventListener("change", () => {
                resolve(input.files?.[0] ?? null);
            }, { once: true });
            input.click();
        });

        if (!file) {
            return;
        }

        const activePath = activeWindowService.getPreferredAssetsPath();
        const relativeFolderPath = activePath.replace(/^\/+/, "");
        const relativeFilePath = relativeFolderPath ? `${relativeFolderPath}/${file.name}` : file.name;
        const fullAssetPath = "/" + relativeFilePath;

        await System.fileSystem.writeFile(relativeFilePath, new Uint8Array(await file.arrayBuffer()));
        editorAssetStore.remove(fullAssetPath);
        editorAssetStore.add({
            id: crypto.randomUUID(),
            name: file.name,
            type: file.name.endsWith(".ts") ? "component" : file.name.endsWith(".json") ? "json" : "file",
            path: fullAssetPath,
            data: ""
        });
    }

    public static syncSettingsFromProjectConfig() {
        if (!ProjectConfig.config) {
            return;
        }

        for (const [path, mapping] of Object.entries(Editor.settingsMapping)) {
            Editor.settingsWindow.setSettingValue(path, mapping.getValue());
        }
    }

    public static init(): void {
        Editor.addBasicComponents();
        const esbuildIndicator = ProcessIndicator.startProcess("Loading esbuild.wasm", "neutral");
        Bundler.init()
            .then(() => esbuildIndicator.complete("esbuild.wasm loaded"))
            .catch(() => esbuildIndicator.fail("Failed to load esbuild.wasm"));

        document.addEventListener("dblclick", e => {
            e.preventDefault();
        });
        Editor.enableLongPressContextMenu(document);

        try {
            Editor.settingsWindow = new SettingsWindow(document.getElementById("settings-window")! as SlDialog);
            Editor.initSettingsWindow();
            Editor.initAssetMenuActions();
            Editor.initWelcomePanel();

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Editor.loadingDialog = document.getElementById("loading-dialog")! as any;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Editor.loadingDialog.addEventListener("sl-request-close", function (event: any) {
                if (event.detail.source === "overlay") {
                    event.preventDefault();
                }
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Editor.loadingDialogProgressBar = Editor.loadingDialog.querySelector("sl-progress-bar")! as any;

            document.getElementById("new-project-button")!.addEventListener("click", ToolBarActions.newProject);
            document.getElementById("open-project-button")!.addEventListener("click", ToolBarActions.openProject);
            Editor.loadRecentProjectsMenu();

            document.getElementById("save-project-button")!.addEventListener("click", ToolBarActions.saveProject);
            document.getElementById("export-project-gz-button")!.addEventListener("click", ToolBarActions.exportProjectArchive);
            document.getElementById("import-project-gz-button")!.addEventListener("click", ToolBarActions.importProjectArchive);
            document.addEventListener("keydown", async function (event) {
                if (event.ctrlKey && event.code === "KeyS") {
                    event.preventDefault();
                    await ToolBarActions.saveProject();
                }
            }, true);
            document.getElementById("download-build-button")!.addEventListener("click", ToolBarActions.downloadtBuild);

            document.getElementById("build-and-run-button")!.addEventListener("click", ToolBarActions.buildAndRun);
            document.addEventListener("keydown", async function (event) {
                if (event.ctrlKey && event.code === "KeyB") {
                    event.preventDefault();
                    await ToolBarActions.buildAndRun();
                }
            }, true);

            document.getElementById("compile-button")!.addEventListener("click", ToolBarActions.compile);
            document.addEventListener("keydown", async function (event) {
                if (event.ctrlKey && event.code === "KeyQ") {
                    event.preventDefault();
                    await ToolBarActions.compile();
                }
            }, true);

            document.getElementById("reset-layout-button")!.addEventListener("click", ToolBarActions.resetLayout);
            document.getElementById("diagnose-problems")!.addEventListener("click", () => {
                void openProblemsReport();
            });

            RuntimeErrorCapture.install();
            document.getElementById("new-viewport-window-button")?.addEventListener("click", () => spawnEditorWindow("Viewport"));
            document.getElementById("new-game-window-button")?.addEventListener("click", () => spawnEditorWindow("Game"));
            document.getElementById("new-code-editor-window-button")?.addEventListener("click", () => spawnEditorWindow("CodeEditor"));
            document.getElementById("new-hierarchy-window-button")?.addEventListener("click", () => spawnEditorWindow("Hierarchy"));
            document.getElementById("new-assets-window-button")?.addEventListener("click", () => spawnEditorWindow("Assets"));
            document.getElementById("new-inspector-window-button")?.addEventListener("click", () => spawnEditorWindow("Inspector"));

            this.runButton = document.getElementById("run-button")! as HTMLButtonElement;

            this.runButton.addEventListener("click", ToolBarActions.runProject);
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            this.runButtonIcon = this.runButton.querySelector("sl-icon")! as any;

            this.qrPreviewWindow = new PreviewServer(document.getElementById("qr-preview-window")! as SlDialog);

            window.addEventListener("beforeunload", (event) => {
                if (Project.needsSave()) {
                    event.preventDefault();
                    event.returnValue = "";
                }
            });

        } catch (error) {
            console.error(`Error: Failed to initialize UI: ${error}`);
        }

        Editor.updateWindowFields();
        Editor.loadEngineFiles();

        EditorName("New Layer")(Layer); // Adding here because we don`t want this in game
        EditorName("New GameObject")(GameObject);
        CodeEditor.openFile("project-config.json");
    }

    private static createDefaultProject(): ProjectTemplate {
        return {
            data: ProjectLoader.deserialize(defaultProjectData()),
            files: defaultProjectFiles(),
            components: defaultProjectComponents()
        };
    }

    public static async loadEngineFiles() {
        const indicator = ProcessIndicator.startProcess("Loading engine files", "neutral");

        for (const [filePath, content] of Object.entries(engineSrcFiles)) {
            Bundler.flintFiles.set(filePath, content);
        }

        for (const [filePath, content] of Object.entries(editorSrcFiles)) {
            Bundler.flintFiles.set(filePath, content);
        }

        indicator.complete("Engine loaded");
        Editor._resolveEngineFilesReady();
    }

    public static updateWindowFields() {
        refreshEditorWindows();
        requestAnimationFrame(Editor.updateWindowFields);
    }

    public static onProjectLoad() {
        Editor.runButton.disabled = false;
        Editor.syncSettingsFromProjectConfig();
        refreshEditorWindows("Hierarchy");
        refreshEditorWindows("Inspector");
    }

    public static getPrimaryHierarchyWindow(): HierarchyWindow | undefined {
        return getEditorWindowsOfType<HierarchyWindow>("Hierarchy")[0];
    }
}
