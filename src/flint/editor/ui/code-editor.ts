import type { ComponentContainer } from "golden-layout";
import { System } from "@flint/runtime/system";
import ProjectConfig from "../project/project-config";
import type { WindowType } from "./window-framework";
import { getCrossWindowChannel } from "../cross-window";

type ExportResult = {
    defaultExport?: string;
    exports?: string[];
};

type ModuleExports = ExportResult & {
    path: string;
};

function parseExports(code: string): ExportResult {
    const result: ExportResult = { exports: [] };
    const tokens = code.split(/\s+/);
    let i = 0;

    while (i < tokens.length) {
        const token = tokens[i];

        if (token === "export" && tokens[i + 1] === "default") {
            i += 2;
            const nextToken = tokens[i];
            if (nextToken) {
                if (nextToken === "function" || nextToken === "class" || nextToken === "const" || nextToken === "let" || nextToken === "var") {
                    const nameToken = tokens[i + 1];
                    if (nameToken) {
                        result.defaultExport = nameToken.replace(/[({]/g, "");
                        i += 1;
                    }
                } else {
                    result.defaultExport = nextToken.replace(/;/g, "");
                }
            }
        } else if (token === "export") {
            const nextToken = tokens[i + 1];
            if (nextToken === "{") {
                i += 2;
                while (i < tokens.length && tokens[i] !== "}") {
                    const name = tokens[i]!.replace(/,/g, "");
                    if (name) {
                        result.exports!.push(name);
                    }
                    i++;
                }
            } else if (nextToken === "function" || nextToken === "class" || nextToken === "const" || nextToken === "let" || nextToken === "var" || nextToken === "type" || nextToken === "interface") {
                const nameToken = tokens[i + 2];
                if (nameToken) {
                    result.exports!.push(nameToken.replace(/[({;]/g, ""));
                }
                i += 2;
            } else if (nextToken === "async" && tokens[i + 2] === "function") {
                const nameToken = tokens[i + 3];
                if (nameToken) {
                    result.exports!.push(nameToken.replace(/[({;]/g, ""));
                }
                i += 3;
            }
        }
        i++;
    }

    if (result.exports!.length === 0) {
        delete result.exports;
    }

    return result;
}

function toModuleSpecifier(filePath: string): string {
    const normalized = filePath.replace(/\\/g, "/");
    if (normalized.endsWith(".d.ts")) {
        return normalized.slice(0, -".d.ts".length);
    }

    return normalized.replace(/\.(ts|tsx|js|jsx|json)$/i, "");
}

interface EditorModel {
    getValue: () => string;
    getLineContent: (line: number) => string;
    getLineCount: () => number;
    getValueInRange: (range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }) => string;
    getWordUntilPosition: (position: { lineNumber: number; column: number }) => { word: string; startColumn: number; endColumn: number };
    onDidChangeContent: (callback: () => void) => void;
}

interface IStandaloneCodeEditor {
    getModel: () => EditorModel | null;
    setModel: (model: EditorModel) => void;
    focus: () => void;
    addCommand: (keybinding: number, handler: () => void) => void;
}

type EditorTab = {
    path: string;
    model: EditorModel;
    originalContent: string;
};

type EditorWindowController = {
    instanceId: string;
    container: HTMLElement;
    panelContainer: ComponentContainer | null;
    editor: IStandaloneCodeEditor;
    model: EditorModel | null;
    currentPath: string;
    tabs: Map<string, EditorTab>;
    activeTabPath: string | null;
    hasUnsavedChanges: boolean;
    autoSaveTimer: ReturnType<typeof setTimeout> | null;
    setTitle: (title: string) => void;
};

type WindowSpawner = (type: WindowType) => string;

export class CodeEditor {
    private static readonly windows = new Map<string, EditorWindowController>();
    private static activeWindowId: string | null = null;
    private static globalActiveId: string | null = null;
    private static globalActiveSourceWindow: string | null = null;
    private static readonly instanceOwners = new Map<string, string>();
    private static readonly windowId = (window.opener ? `popout-${crypto.randomUUID().slice(0, 8)}` : "main");
    private static crossWindowInited = false;
    private static spawnWindow: WindowSpawner | null = null;
    private static initializing = false;
    private static readonly initialWindowWaitMs = 250;

    private static readonly typeNames: Record<string, string> = {
        "ts": "typescript",
        "tsx": "typescript",
        "js": "javascript",
        "jsx": "javascript",
        "json": "json"
    };

    private static modulesByPath: Map<string, ModuleExports> = new Map();
    private static completionsInstalled = false;
    private static monacoLoadPromise: Promise<void> | null = null;
    private static libsLoaded = false;
    private static beforeUnloadInstalled = false;

    private static readonly autoSaveDelayMs = 300;

    private constructor() { }

    private static get Monaco() {
        return window.monaco;
    }

    public static setWindowSpawner(spawner: WindowSpawner): void {
        this.spawnWindow = spawner;
    }

    private static initCrossWindowSync(): void {
        if (this.crossWindowInited) {
            return;
        }

        this.crossWindowInited = true;
        const channel = getCrossWindowChannel();
        channel.subscribe(msg => {
            if (msg.type === "CODE_EDITOR_ACTIVATED") {
                this.globalActiveId = msg.instanceId;
                this.globalActiveSourceWindow = msg.sourceWindow;
                this.instanceOwners.set(msg.instanceId, msg.sourceWindow);
            } else if (msg.type === "CODE_EDITOR_OPEN_FILE" && msg.targetWindow === this.windowId) {
                void this.openFile(msg.path, msg.instanceId);
            }
        });
    }

    private static getMonacoVsPath(): string {
        const globalConfig = globalThis as {
            FLINT_MONACO_VS_PATH?: string;
            require?: {
                paths?: {
                    vs?: string;
                };
            };
        };

        return globalConfig.FLINT_MONACO_VS_PATH
            ?? globalConfig.require?.paths?.vs
            ?? "./dist/vendor/monaco/vs";
    }

    private static getLanguageFromPath(path: string): string {
        const ext = path.split(".").at(-1) ?? "";
        return this.typeNames[ext] ?? "typescript";
    }

    private static hasTypescriptSupport(): boolean {
        const monaco = this.Monaco as {
            editor?: { create?: unknown };
            languages?: {
                typescript?: {
                    typescriptDefaults?: unknown;
                };
            };
        };

        return Boolean(
            monaco?.editor?.create &&
            monaco?.languages?.typescript?.typescriptDefaults
        );
    }

    private static async waitForMonaco(): Promise<void> {
        if (this.hasTypescriptSupport()) {
            return;
        }

        if (!this.monacoLoadPromise) {
            this.monacoLoadPromise = new Promise<void>((resolve, reject) => {
                const amdRequire = (globalThis as {
                    require?: ((modules: string[], onLoad: () => void, onError?: (error: unknown) => void) => void) & {
                        config?: (options: { paths: Record<string, string> }) => void;
                    };
                }).require;

                if (typeof amdRequire === "function") {
                    amdRequire.config?.({
                        paths: {
                            vs: this.getMonacoVsPath()
                        }
                    });

                    amdRequire(
                        ["vs/editor/editor.main", "vs/language/typescript/monaco.contribution"],
                        () => resolve(),
                        error => reject(error instanceof Error ? error : new Error(String(error)))
                    );
                    return;
                }

                const maxAttempts = 100;
                const interval = 100;
                let attempts = 0;

                const poll = () => {
                    if (this.hasTypescriptSupport()) {
                        resolve();
                        return;
                    }

                    attempts += 1;
                    if (attempts >= maxAttempts) {
                        reject(new Error("Monaco editor failed to load"));
                        return;
                    }

                    setTimeout(poll, interval);
                };

                poll();
            });
        }

        await this.monacoLoadPromise;

        if (!this.hasTypescriptSupport()) {
            throw new Error("Monaco TypeScript support failed to load");
        }
    }

    public static async createWindow(
        instanceId: string,
        container: HTMLElement,
        setTitle: (title: string) => void,
        panelContainer?: ComponentContainer
    ): Promise<void> {
        await this.waitForMonaco();
        this.installGlobalMonacoSettings();
        this.installBeforeUnloadGuard();

        const Monaco = this.Monaco;
        const editor = Monaco.editor.create(container, {
            value: "// Welcome to Flint Code Editor\n// Double-click a file in the Assets panel to open it here.",
            language: "typescript",
            automaticLayout: true
        }) as IStandaloneCodeEditor;

        const controller: EditorWindowController = {
            instanceId,
            container,
            panelContainer: panelContainer ?? null,
            editor,
            model: editor.getModel(),
            currentPath: "",
            tabs: new Map(),
            activeTabPath: null,
            hasUnsavedChanges: false,
            autoSaveTimer: null,
            setTitle
        };

        if (controller.model) {
            this.attachModelListeners(controller, controller.model);
        }

        editor.addCommand(Monaco.KeyMod.CtrlCmd | Monaco.KeyCode.KeyS, () => {
            void this.saveCurrentFile(instanceId);
        });

        this.windows.set(instanceId, controller);
        if (!this.activeWindowId) {
            this.activeWindowId = instanceId;
        }
    }

    public static destroyWindow(instanceId: string): void {
        const controller = this.windows.get(instanceId);
        if (!controller) {
            return;
        }

        if (controller.autoSaveTimer) {
            clearTimeout(controller.autoSaveTimer);
        }

        this.windows.delete(instanceId);
        if (this.activeWindowId === instanceId) {
            const nextWindow = this.windows.keys().next();
            this.activeWindowId = nextWindow.done ? null : nextWindow.value;
        }
    }

    public static activateWindow(instanceId: string): void {
        if (this.windows.has(instanceId)) {
            this.activeWindowId = instanceId;
            this.initCrossWindowSync();
            getCrossWindowChannel().send({
                type: "CODE_EDITOR_ACTIVATED",
                instanceId,
                sourceWindow: this.windowId
            });
        }
    }

    private static installGlobalMonacoSettings(): void {
        const Monaco = this.Monaco;
        Monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            target: Monaco.languages.typescript.ScriptTarget.ESNext,
            module: Monaco.languages.typescript.ModuleKind.ESNext,
            moduleResolution: Monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            strict: true,
            allowNonTsExtensions: true,
            baseUrl: "./",
            paths: {
                "@flint/*": ["@flint/*"]
            }
        });

        Monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
            noSemanticValidation: false,
            noSyntaxValidation: false,
            diagnosticCodesToIgnore: []
        });

        Monaco.languages.typescript.typescriptDefaults.setMaximumWorkerIdleTime(2 * 60 * 1000);
        Monaco.editor.setTheme("vs-dark");
    }

    private static installBeforeUnloadGuard(): void {
        if (this.beforeUnloadInstalled) {
            return;
        }

        this.beforeUnloadInstalled = true;
        window.addEventListener("beforeunload", event => {
            const hasUnsavedChanges = [...this.windows.values()].some(windowController => {
                this.checkForUnsavedChanges(windowController);
                return windowController.hasUnsavedChanges;
            });

            if (hasUnsavedChanges) {
                event.preventDefault();
                event.returnValue = "";
            }
        });
    }

    private static attachModelListeners(controller: EditorWindowController, model: EditorModel): void {
        model.onDidChangeContent(() => {
            this.checkForUnsavedChanges(controller);
            this.scheduleAutoSave(controller);
        });
    }

    private static scheduleAutoSave(controller: EditorWindowController): void {
        if (!controller.currentPath || !controller.model) {
            return;
        }

        if (controller.autoSaveTimer) {
            clearTimeout(controller.autoSaveTimer);
        }

        controller.autoSaveTimer = setTimeout(() => {
            controller.autoSaveTimer = null;
            void this.saveCurrentFile(controller.instanceId);
        }, this.autoSaveDelayMs);
    }

    private static focusWindow(controller: EditorWindowController): void {
        controller.panelContainer?.focus();
        controller.editor.focus();
    }

    private static getWindow(instanceId: string): EditorWindowController {
        const controller = this.windows.get(instanceId);
        if (!controller) {
            throw new Error(`Code editor window "${instanceId}" was not found.`);
        }

        return controller;
    }

    private static getOrCreateActiveWindowId(): string | null {
        if (this.activeWindowId && this.windows.has(this.activeWindowId)) {
            return this.activeWindowId;
        }

        for (const [id] of this.windows) {
            this.activeWindowId = id;
            return id;
        }

        if (this.spawnWindow) {
            this.activeWindowId = this.spawnWindow("CodeEditor");
            return this.activeWindowId;
        }

        return null;
    }

    private static async waitForExistingWindow(timeoutMs = this.initialWindowWaitMs): Promise<string | null> {
        const deadline = performance.now() + timeoutMs;

        while (performance.now() < deadline) {
            const existingWindowId = this.getOrCreateActiveWindowIdWithoutSpawn();
            if (existingWindowId) {
                return existingWindowId;
            }

            await new Promise<void>(resolve => {
                requestAnimationFrame(() => resolve());
            });
        }

        return this.getOrCreateActiveWindowIdWithoutSpawn();
    }

    private static getOrCreateActiveWindowIdWithoutSpawn(): string | null {
        if (this.activeWindowId && this.windows.has(this.activeWindowId)) {
            return this.activeWindowId;
        }

        for (const [id] of this.windows) {
            this.activeWindowId = id;
            return id;
        }

        return null;
    }

    public static async openFile(path: string, instanceId?: string): Promise<void> {
        this.initCrossWindowSync();

        if (instanceId) {
            if (this.windows.has(instanceId)) {
                // proceed with local instance
            } else {
                const targetWindow = this.instanceOwners.get(instanceId) ?? "";
                getCrossWindowChannel().send({
                    type: "CODE_EDITOR_OPEN_FILE",
                    path,
                    instanceId,
                    targetWindow
                });
                return;
            }
        } else {
            if (this.globalActiveId && this.globalActiveSourceWindow === this.windowId && this.windows.has(this.globalActiveId)) {
                instanceId = this.globalActiveId;
            } else if (this.globalActiveId && this.globalActiveSourceWindow !== this.windowId) {
                getCrossWindowChannel().send({
                    type: "CODE_EDITOR_OPEN_FILE",
                    path,
                    instanceId: this.globalActiveId,
                    targetWindow: this.globalActiveSourceWindow ?? ""
                });
                return;
            }
        }

        let targetWindowId = instanceId
            ?? this.getOrCreateActiveWindowIdWithoutSpawn()
            ?? await this.waitForExistingWindow();

        if (!targetWindowId) {
            await this.waitForMonaco();
            targetWindowId = this.getOrCreateActiveWindowId();
        }

        if (!targetWindowId) {
            return;
        }

        let controller = this.windows.get(targetWindowId);
        if (!controller) {
            await this.waitForMonaco();
            controller = this.windows.get(targetWindowId);
            if (!controller) {
                targetWindowId = this.getOrCreateActiveWindowId();
                if (!targetWindowId) {
                    return;
                }
                controller = this.windows.get(targetWindowId);
                if (!controller) {
                    return;
                }
            }
        }

        await this.ensureLibrariesLoaded();

        const existingTab = controller.tabs.get(path);
        if (existingTab) {
            this.switchToTab(controller, path);
            return;
        }

        const text = await System.fileSystem.readTextFile(path);
        const language = this.getLanguageFromPath(path);

        const model = this.Monaco.editor.createModel(text, language) as EditorModel;
        this.attachModelListeners(controller, model);
        controller.editor.setModel(model);
        controller.model = model;

        controller.tabs.set(path, {
            path,
            model,
            originalContent: text
        });

        controller.activeTabPath = path;
        controller.currentPath = path;
        controller.setTitle(path);
        this.focusWindow(controller);
    }

    private static switchToTab(controller: EditorWindowController, path: string): void {
        const tab = controller.tabs.get(path);
        if (!tab) {
            return;
        }

        controller.editor.setModel(tab.model);
        controller.model = tab.model;
        controller.activeTabPath = path;
        controller.currentPath = path;
        controller.setTitle(path);
        this.focusWindow(controller);
    }

    public static async saveCurrentFile(instanceId?: string): Promise<void> {
        const resolvedInstanceId = instanceId ?? this.activeWindowId;
        if (!resolvedInstanceId) {
            return;
        }

        const controller = this.windows.get(resolvedInstanceId);
        if (!controller || !controller.currentPath || !controller.model) {
            return;
        }

        if (controller.autoSaveTimer) {
            clearTimeout(controller.autoSaveTimer);
            controller.autoSaveTimer = null;
        }

        const text = controller.model.getValue();
        await System.fileSystem.writeTextFile(controller.currentPath, text);

        const tab = controller.tabs.get(controller.currentPath);
        if (tab) {
            tab.originalContent = text;
        }
        controller.hasUnsavedChanges = false;
    }

    private static checkForUnsavedChanges(controller: EditorWindowController): void {
        const tab = controller.tabs.get(controller.currentPath);
        if (!tab || !controller.model) {
            controller.hasUnsavedChanges = false;
            return;
        }

        controller.hasUnsavedChanges = controller.model.getValue() !== tab.originalContent;
    }

    private static async ensureLibrariesLoaded(): Promise<void> {
        if (this.libsLoaded || !System.fileSystem.started) {
            return;
        }

        this.libsLoaded = true;
        await this.loadFlintFolder("flint");
        await this.loadAssetsFolder("assets");
        await this.loadProjectFiles();
    }

    private static async loadProjectFiles(): Promise<void> {
        if (ProjectConfig.config.rootPath === "virtual") {
            return;
        }

        const files: { path: string; text: string }[] = [];

        const loadDirectory = async (dirPath: string, basePath = "") => {
            try {
                const entries = await System.fileSystem.listDir(dirPath);

                for (const entry of entries) {
                    const fullPath = `${dirPath}/${entry}`;
                    const isFile = entry.includes(".");

                    if (isFile) {
                        try {
                            const text = await System.fileSystem.readTextFile(fullPath);
                            const filePath = basePath ? `${basePath}/${entry}` : entry;
                            files.push({ path: filePath, text });
                        } catch (error) {
                            console.warn(`Failed to read file: ${fullPath}`, error);
                        }
                    } else {
                        const subPath = basePath ? `${basePath}/${entry}` : entry;
                        await loadDirectory(fullPath, subPath);
                    }
                }
            } catch (error) {
                console.warn(`Failed to read directory: ${dirPath}`, error);
            }
        };

        await loadDirectory(".");
        this.addExtraLibs(files);
    }

    public static addExtraLibs(files: { path: string; text: string }[]): void {
        const modules: ModuleExports[] = files.map(file => ({
            path: toModuleSpecifier(file.path),
            ...parseExports(file.text)
        }));

        const Monaco = this.Monaco;
        for (const file of files) {
            const path = file.path.replace(/\\/g, "/");
            Monaco.languages.typescript.typescriptDefaults.addExtraLib(file.text, path);
            Monaco.languages.typescript.javascriptDefaults.addExtraLib(file.text, path);
        }

        this.ensureCompletionsInstalled(modules);
    }

    private static upsertModules(modules: ModuleExports[]): void {
        for (const mod of modules) {
            if (!mod || typeof mod.path !== "string") {
                continue;
            }

            this.modulesByPath.set(mod.path, mod);
        }
    }

    private static isInImportPath(model: import("monaco-editor").ITextModel, position: import("monaco-editor").Position): boolean {
        const line = model.getLineContent(position.lineNumber);
        const prefix = line.slice(0, Math.max(0, position.column - 1));
        return /(?:from\s+|import\s+)(["'])([^"']*)$/.test(prefix);
    }

    private static computeImportInsertRange(model: import("monaco-editor").ITextModel): import("monaco-editor").IRange {
        const lineCount = model.getLineCount();
        let lineNumber = 1;

        while (lineNumber <= lineCount) {
            const line = model.getLineContent(lineNumber);
            if (/^\s*$/.test(line) || /^\s*\/\//.test(line)) {
                lineNumber++;
                continue;
            }

            if (/^\s*import\b/.test(line)) {
                lineNumber++;
                continue;
            }

            break;
        }

        return { startLineNumber: lineNumber, startColumn: 1, endLineNumber: lineNumber, endColumn: 1 };
    }

    private static hasImport(model: import("monaco-editor").ITextModel, modulePath: string, kind: string, name: string): boolean {
        const head = model.getValueInRange({
            startLineNumber: 1,
            startColumn: 1,
            endLineNumber: Math.min(200, model.getLineCount()),
            endColumn: 1
        });

        const escapeRegExp = (text: string) => String(text).replace(/[.*+?^{}$()|[\]\\]/g, "\\$&");

        if (kind === "module") {
            return new RegExp("\\bfrom\\s*[\\x27\\x22]" + escapeRegExp(modulePath) + "[\\x27\\x22]").test(head);
        }

        if (kind === "default") {
            return new RegExp("\\bimport\\s+" + escapeRegExp(name) + "\\s*(,\\s*\\{[^}]*\\}\\s*)?from\\s*[\\x27\\x22]" + escapeRegExp(modulePath) + "[\\x27\\x22]").test(head);
        }

        return new RegExp("\\bimport\\s*\\{[^}]*\\b" + escapeRegExp(name) + "\\b[^}]*\\}\\s*from\\s*[\\x27\\x22]" + escapeRegExp(modulePath) + "[\\x27\\x22]").test(head);
    }

    private static ensureCompletionsInstalled(modules: ModuleExports[]): void {
        if (this.completionsInstalled) {
            this.upsertModules(modules);
            return;
        }

        this.completionsInstalled = true;
        this.upsertModules(modules);

        const Monaco = this.Monaco;

        for (const language of ["typescript", "javascript"]) {
            const monaco = this.Monaco as { languages?: { registerCompletionItemProvider?: (language: string, provider: { triggerCharacters?: string[]; provideCompletionItems: (model: import("monaco-editor").ITextModel, position: import("monaco-editor").Position) => { suggestions: unknown[] } }) => void } };

            monaco.languages?.registerCompletionItemProvider?.(language, {
                triggerCharacters: ["'", "\"", "/", "\\"],
                provideCompletionItems: (model, position) => {
                    const line = model.getLineContent(position.lineNumber);
                    const prefix = line.slice(0, Math.max(0, position.column - 1));
                    const match = prefix.match(/(?:from\s+|import\s+)(["'])([^"']*)$/);
                    if (!match) {
                        return { suggestions: [] };
                    }

                    const typed = match[2] ?? "";
                    const normalizedTyped = typed.replace(/\\\\/g, "/");
                    const startColumn = position.column - typed.length;
                    const range = {
                        startLineNumber: position.lineNumber,
                        endLineNumber: position.lineNumber,
                        startColumn,
                        endColumn: position.column
                    };

                    const seen = new Set<string>();
                    const suggestions: any[] = [];

                    if (normalizedTyped.endsWith("/")) {
                        const prefixToMatch = normalizedTyped.slice(0, -1);
                        const pathCompletions = new Set<string>();

                        for (const mod of this.modulesByPath.values()) {
                            if (typeof mod.path !== "string" || !mod.path.startsWith(prefixToMatch + "/")) {
                                continue;
                            }

                            const remainder = mod.path.slice(prefixToMatch.length + 1);
                            const nextSegment = remainder.split("/")[0];
                            if (nextSegment) {
                                pathCompletions.add(nextSegment);
                            }
                        }

                        for (const completion of pathCompletions) {
                            const fullPath = normalizedTyped + completion;
                            if (seen.has(fullPath)) {
                                continue;
                            }

                            seen.add(fullPath);
                            suggestions.push({
                                label: completion,
                                kind: Monaco.languages.CompletionItemKind.Folder,
                                insertText: completion,
                                range,
                                detail: "Directory"
                            });
                        }
                    } else {
                        for (const mod of this.modulesByPath.values()) {
                            if (typeof mod.path !== "string") {
                                continue;
                            }

                            if (normalizedTyped && !mod.path.startsWith(normalizedTyped)) {
                                continue;
                            }

                            if (seen.has(mod.path)) {
                                continue;
                            }

                            seen.add(mod.path);
                            suggestions.push({
                                label: mod.path,
                                kind: Monaco.languages.CompletionItemKind.Module,
                                insertText: mod.path,
                                range,
                                detail: this.hasImport(model, mod.path, "module", "") ? "Already imported" : "Module"
                            });
                        }
                    }

                    return { suggestions };
                }
            });

            Monaco.languages.registerCompletionItemProvider(language, {
                provideCompletionItems: (model: any, position: any) => {
                    if (this.isInImportPath(model, position)) {
                        return { suggestions: [] };
                    }

                    const word = model.getWordUntilPosition(position);
                    const range = {
                        startLineNumber: position.lineNumber,
                        endLineNumber: position.lineNumber,
                        startColumn: word.startColumn,
                        endColumn: word.endColumn
                    };

                    const insertRange = this.computeImportInsertRange(model);
                    const suggestions: any[] = [];

                    for (const mod of this.modulesByPath.values()) {
                        if (typeof mod.path !== "string") {
                            continue;
                        }

                        if (typeof mod.defaultExport === "string" && mod.defaultExport.length > 0) {
                            suggestions.push({
                                label: mod.defaultExport,
                                kind: Monaco.languages.CompletionItemKind.Class,
                                insertText: mod.defaultExport,
                                detail: `Auto import default from '${mod.path}'`,
                                range,
                                additionalTextEdits: this.hasImport(model, mod.path, "default", mod.defaultExport)
                                    ? []
                                    : [{ range: insertRange, text: `import ${mod.defaultExport} from "${mod.path}";\n` }]
                            });
                        }

                        if (!Array.isArray(mod.exports)) {
                            continue;
                        }

                        for (const name of mod.exports) {
                            if (!name) {
                                continue;
                            }

                            suggestions.push({
                                label: name,
                                kind: Monaco.languages.CompletionItemKind.Class,
                                insertText: name,
                                detail: `Auto import from '${mod.path}'`,
                                range,
                                additionalTextEdits: this.hasImport(model, mod.path, "named", name)
                                    ? []
                                    : [{ range: insertRange, text: `import { ${name} } from "${mod.path}";\n` }]
                            });
                        }
                    }

                    return { suggestions };
                }
            });
        }
    }

    public static async loadAssetsFolder(assetsFolderPath = "assets"): Promise<void> {
        const files: { path: string; text: string }[] = [];

        const loadDirectory = async (dirPath: string, baseAlias = "") => {
            try {
                const entries = await System.fileSystem.listDir(dirPath);

                for (const entry of entries) {
                    const fullPath = `${dirPath}/${entry}`;
                    const isFile = entry.includes(".");

                    if (isFile) {
                        try {
                            const text = await System.fileSystem.readTextFile(fullPath);
                            const aliasPath = baseAlias ? `${baseAlias}/${entry}` : entry;
                            files.push({ path: aliasPath, text });
                        } catch (error) {
                            console.warn(`Failed to read file: ${fullPath}`, error);
                        }
                    } else {
                        const subAlias = baseAlias ? `${baseAlias}/${entry}` : entry;
                        await loadDirectory(fullPath, subAlias);
                    }
                }
            } catch (error) {
                console.warn(`Failed to read directory: ${dirPath}`, error);
            }
        };

        await loadDirectory(assetsFolderPath);
        this.addExtraLibs(files);
    }

    public static async loadFlintFolder(flintFolderPath = "flint"): Promise<void> {
        const files: Array<{ path: string; text: string }> = [];

        const loadDirectory = async (dirPath: string, basePath = "") => {
            try {
                const entries = await System.fileSystem.listDir(dirPath);

                for (const entry of entries) {
                    const fullPath = `${dirPath}/${entry}`;
                    const isFile = entry.includes(".");

                    if (isFile) {
                        try {
                            const text = await System.fileSystem.readTextFile(fullPath);
                            const flintPath = basePath ? `${basePath}/${entry}` : entry;
                            files.push({ path: `@flint/${flintPath}`, text });
                        } catch (error) {
                            console.warn(`Failed to read file: ${fullPath}`, error);
                        }
                    } else {
                        const subPath = basePath ? `${basePath}/${entry}` : entry;
                        await loadDirectory(fullPath, subPath);
                    }
                }
            } catch (error) {
                console.warn(`Failed to read directory: ${dirPath}`, error);
            }
        };

        await loadDirectory(flintFolderPath);
        this.addExtraLibs(files);
    }
}
