import { System } from "@flint/runtime/system";
import ProjectConfig from "./project/project-config";

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

        if (token === 'export' && tokens[i + 1] === 'default') {
            i += 2;
            const nextToken = tokens[i];
            if (nextToken) {
                if (nextToken === 'function' || nextToken === 'class' || nextToken === 'const' || nextToken === 'let' || nextToken === 'var') {
                    const nameToken = tokens[i + 1];
                    if (nameToken) {
                        result.defaultExport = nameToken.replace(/[({]/g, '');
                        i += 1;
                    }
                } else {
                    result.defaultExport = nextToken.replace(/;/, '');
                }
            }
        } else if (token === 'export') {
            const nextToken = tokens[i + 1];
            if (nextToken === '{') {
                i += 2;
                while (i < tokens.length && tokens[i] !== '}') {
                    const name = tokens[i]!.replace(/,/, '');
                    if (name) result.exports!.push(name);
                    i++;
                }
            } else if (nextToken === 'function' || nextToken === 'class' || nextToken === 'const' || nextToken === 'let' || nextToken === 'var' || nextToken === 'type' || nextToken === 'interface') {
                const nameToken = tokens[i + 2];
                if (nameToken) result.exports!.push(nameToken.replace(/[({;]/g, ''));
                i += 2;
            } else if (nextToken === 'async') {
                const afterAsync = tokens[i + 2];
                if (afterAsync === 'function') {
                    const nameToken = tokens[i + 3];
                    if (nameToken) result.exports!.push(nameToken.replace(/[({;]/g, ''));
                    i += 3;
                }
            } else if (nextToken === '*') {
                if (tokens[i + 2] === 'from') {
                    const modulePath = tokens[i + 3];
                    if (modulePath) result.exports!.push(modulePath.replace(/['";]/g, ''));
                    i += 4;
                }
            }
        }
        i++;
    }

    if (result.exports!.length === 0) delete result.exports;
    return result;
}

function toModuleSpecifier(filePath: string): string {
    const normalized = filePath.replace(/\\/g, "/");
    if (normalized.endsWith(".d.ts")) return normalized.slice(0, -".d.ts".length);
    return normalized.replace(/\.(ts|tsx|js|jsx|json)$/i, "");
}

interface EditorTab {
    path: string;
    model: {
        getValue: () => string;
        getLineContent: (line: number) => string;
        getLineCount: () => number;
        getValueInRange: (range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }) => string;
        getWordUntilPosition: (position: { lineNumber: number; column: number }) => { word: string; startColumn: number; endColumn: number };
        onDidChangeContent: (callback: () => void) => void;
    };
    originalContent: string;
}

interface IStandaloneCodeEditor {
    getModel: () => EditorTab["model"] | null;
    setModel: (model: EditorTab["model"]) => void;
    focus: () => void;
    addCommand: (keybinding: number, handler: () => void) => void;
}

export class CodeEditor {
    private static container: HTMLElement | null = null;
    private static editor: IStandaloneCodeEditor | null = null;
    private static model: EditorTab["model"] | null = null;
    private static currentPath: string = "";
    private static tabs: Map<string, EditorTab> = new Map();
    private static activeTabPath: string | null = null;
    private static isInitialized: boolean = false;
    private static modulesByPath: Map<string, ModuleExports> = new Map();
    private static completionsInstalled: boolean = false;
    private static hasUnsavedChanges: boolean = false;
    private static autoSaveTimer: ReturnType<typeof setTimeout> | null = null;

    private static readonly autoSaveDelayMs: number = 300;

    private static readonly typeNames: Record<string, string> = {
        "ts": "typescript",
        "tsx": "typescript",
        "js": "javascript",
        "jsx": "javascript",
        "json": "json"
    };

    private constructor() { }

    private static get Monaco() {
        return window.monaco;
    }

    private static getLanguageFromPath(path: string): string {
        const ext = path.split(".").at(-1) ?? "";
        return this.typeNames[ext] ?? "typescript";
    }

    public static isReady(): boolean {
        return this.isInitialized;
    }

    private static attachModelListeners(model: EditorTab["model"]): void {
        model.onDidChangeContent(() => {
            this.checkForUnsavedChanges();
            this.scheduleAutoSave();
        });
    }

    private static scheduleAutoSave(): void {
        if (!this.currentPath || !this.editor || !this.model) return;

        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
        }

        this.autoSaveTimer = setTimeout(() => {
            this.autoSaveTimer = null;
            void this.saveCurrentFile();
        }, this.autoSaveDelayMs);
    }

    private static async waitForMonaco(): Promise<void> {
        const maxAttempts = 100;
        const interval = 100;
        for (let i = 0; i < maxAttempts; i++) {
            const monaco = this.Monaco as { editor?: { create?: unknown } };
            if (monaco?.editor?.create) {
                return;
            }
            await new Promise(resolve => setTimeout(resolve, interval));
        }
        throw new Error("Monaco editor failed to load");
    }

    private static libsLoaded: boolean = false;

    public static async init(container: HTMLElement): Promise<void> {
        if (this.isInitialized) return;

        this.container = container;

        await this.waitForMonaco();

        const Monaco = this.Monaco;

        Monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
            target: Monaco.languages.typescript.ScriptTarget.ESNext,
            module: Monaco.languages.typescript.ModuleKind.ESNext,
            moduleResolution: Monaco.languages.typescript.ModuleResolutionKind.NodeJs,
            strict: true,
            allowNonTsExtensions: true,
            experimentalDecorators: true,
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

        this.editor = Monaco.editor.create(container, {
            value: "// Welcome to Flint Code Editor\n// Double-click a file in the Assets panel to open it here.",
            language: "typescript",
            automaticLayout: true
        });

        const model = this.editor.getModel();
        if (model) {
            this.model = model;
            this.attachModelListeners(model);
        }
        this.isInitialized = true;

        this.editor.addCommand(Monaco.KeyMod.CtrlCmd | Monaco.KeyCode.KeyS, () => {
            void this.saveCurrentFile();
        });

        window.addEventListener("beforeunload", (event) => {
            this.checkForUnsavedChanges();
            if (this.hasUnsavedChanges) {
                event.preventDefault();
                event.returnValue = "";
            }
        });
    }

    private static async ensureLibrariesLoaded(): Promise<void> {
        if (this.libsLoaded) return;
        
        if (!System.fileSystem.started) {
            return;
        }

        this.libsLoaded = true;
        await this.loadFlintLibrary();
        await this.loadAssetsLibrary();
        await this.loadProjectFiles();
    }

    private static async loadProjectFiles(): Promise<void> {
        if (ProjectConfig.config.rootPath === "virtual") return;
        
        const files: { path: string; text: string }[] = [];
        
        const loadDirectory = async (dirPath: string, basePath: string = "") => {
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
                        } catch (e) {
                            console.warn(`Failed to read file: ${fullPath}`, e);
                        }
                    } else {
                        const subPath = basePath ? `${basePath}/${entry}` : entry;
                        await loadDirectory(fullPath, subPath);
                    }
                }
            } catch (e) {
                console.warn(`Failed to read directory: ${dirPath}`, e);
            }
        };
        
        await loadDirectory(".");
        this.addExtraLibs(files);
    }

    public static async openFile(path: string): Promise<void> {
        if (!this.editor || !this.isInitialized) return;

        await this.ensureLibrariesLoaded();

        const existingTab = this.tabs.get(path);
        if (existingTab) {
            this.switchToTab(path);
            return;
        }

        const text = await System.fileSystem.readTextFile(path);
        const language = this.getLanguageFromPath(path);

        const model = this.Monaco.editor.createModel(text, language);
        this.attachModelListeners(model);
        this.editor.setModel(model);
        this.model = model;

        this.tabs.set(path, {
            path,
            model,
            originalContent: text
        });

        this.activeTabPath = path;
        this.currentPath = path;

        this.editor.focus();
    }

    private static switchToTab(path: string): void {
        const tab = this.tabs.get(path);
        if (!tab || !this.editor) return;

        this.editor.setModel(tab.model);
        this.model = tab.model;
        this.activeTabPath = path;
        this.currentPath = path;
        this.editor.focus();
    }

    public static async saveCurrentFile(): Promise<void> {
        if (!this.currentPath || !this.editor || !this.model) return;

        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }

        const text = this.model.getValue();
        await System.fileSystem.writeTextFile(this.currentPath, text);

        const tab = this.tabs.get(this.currentPath);
        if (tab) {
            tab.originalContent = text;
        }
        this.hasUnsavedChanges = false;
    }

    private static checkForUnsavedChanges(): void {
        const tab = this.tabs.get(this.currentPath);
        if (!tab || !this.model) {
            this.hasUnsavedChanges = false;
            return;
        }
        const currentContent = this.model.getValue();
        this.hasUnsavedChanges = currentContent !== tab.originalContent;
    }

    public static addExtraLibs(files: { path: string; text: string }[]): void {
        const modules: ModuleExports[] = files.map((file) => ({
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
            if (!mod || typeof mod.path !== "string") continue;
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
        const languages = ["typescript", "javascript"];

        for (const language of languages) {
            const monaco = this.Monaco as { languages?: { registerCompletionItemProvider?: (language: string, provider: { triggerCharacters: string[]; provideCompletionItems: (model: import("monaco-editor").ITextModel, position: import("monaco-editor").Position) => { suggestions: unknown[] } }) => void } };
            monaco.languages?.registerCompletionItemProvider?.(language, {
                triggerCharacters: ["'", '"', "/", "\\"],
                provideCompletionItems: (model, position) => {
                    const line = model.getLineContent(position.lineNumber);
                    const prefix = line.slice(0, Math.max(0, position.column - 1));
                    const match = prefix.match(/(?:from\s+|import\s+)(["'])([^"']*)$/);
                    if (!match) return { suggestions: [] };

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
                        const basePath = normalizedTyped.slice(0, -1);
                        const segments = basePath.split("/");
                        const prefixToMatch = segments.join("/");
                        
                        const pathCompletions = new Set<string>();
                        
                        for (const mod of this.modulesByPath.values()) {
                            const modulePath = mod.path;
                            if (typeof modulePath !== "string") continue;
                            
                            if (modulePath.startsWith(prefixToMatch + "/")) {
                                const remainder = modulePath.slice(prefixToMatch.length + 1);
                                const nextSegment = remainder.split("/")[0];
                                if (nextSegment) {
                                    pathCompletions.add(nextSegment);
                                }
                            }
                        }
                        
                        for (const completion of pathCompletions) {
                            const fullPath = normalizedTyped + completion;
                            if (seen.has(fullPath)) continue;
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
                            const modulePath = mod.path;
                            if (typeof modulePath !== "string") continue;
                            if (normalizedTyped && !modulePath.startsWith(normalizedTyped)) continue;
                            if (seen.has(modulePath)) continue;
                            seen.add(modulePath);

                            suggestions.push({
                                label: modulePath,
                                kind: Monaco.languages.CompletionItemKind.Module,
                                insertText: modulePath,
                                range,
                                detail: this.hasImport(model, modulePath, "module", "") ? "Already imported" : "Module"
                            });
                        }
                    }

                    return { suggestions };
                }
            });

            Monaco.languages.registerCompletionItemProvider(language, {
                provideCompletionItems: (model: any, position: any) => {
                    if (this.isInImportPath(model, position)) return { suggestions: [] };

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
                        if (!mod || typeof mod.path !== "string") continue;
                        const modulePath = mod.path;

                        if (typeof mod.defaultExport === "string" && mod.defaultExport.length > 0) {
                            const name = mod.defaultExport;
                            suggestions.push({
                                label: name,
                                kind: Monaco.languages.CompletionItemKind.Class,
                                insertText: name,
                                detail: "Auto import default from '" + modulePath + "'",
                                range,
                                additionalTextEdits: this.hasImport(model, modulePath, "default", name)
                                    ? []
                                    : [{ range: insertRange, text: `import ${name} from "${modulePath}";\n` }]
                            });
                        }

                        if (Array.isArray(mod.exports)) {
                            for (const name of mod.exports) {
                                if (typeof name !== "string" || name.length === 0) continue;
                                suggestions.push({
                                    label: name,
                                    kind: Monaco.languages.CompletionItemKind.Class,
                                    insertText: name,
                                    detail: "Auto import from '" + modulePath + "'",
                                    range,
                                    additionalTextEdits: this.hasImport(model, modulePath, "named", name)
                                        ? []
                                        : [{ range: insertRange, text: `import { ${name} } from "${modulePath}";\n` }]
                                });
                            }
                        }
                    }

                    return { suggestions };
                }
            });
        }
    }

    public static async loadAssetsFolder(assetsFolderPath: string = "assets"): Promise<void> {
        const files: { path: string; text: string }[] = [];

        const loadDirectory = async (dirPath: string, baseAlias: string = "") => {
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
                        } catch (e) {
                            console.warn(`Failed to read file: ${fullPath}`, e);
                        }
                    } else {
                        const subAlias = baseAlias ? `${baseAlias}/${entry}` : entry;
                        await loadDirectory(fullPath, subAlias);
                    }
                }
            } catch (e) {
                console.warn(`Failed to read directory: ${dirPath}`, e);
            }
        };

        await loadDirectory(assetsFolderPath);
        this.addExtraLibs(files);
    }

    public static async loadFlintFolder(flintFolderPath: string = "flint"): Promise<void> {
        const files: Array<{ path: string; text: string }> = [];

        const loadDirectory = async (dirPath: string, basePath: string = "") => {
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
                        } catch (e) {
                            console.warn(`Failed to read file: ${fullPath}`, e);
                        }
                    } else {
                        const subPath = basePath ? `${basePath}/${entry}` : entry;
                        await loadDirectory(fullPath, subPath);
                    }
                }
            } catch (e) {
                console.warn(`Failed to read directory: ${dirPath}`, e);
            }
        };

        await loadDirectory(flintFolderPath);
        this.addExtraLibs(files);
    }

    private static async loadFlintLibrary(): Promise<void> {
        await this.loadFlintFolder("flint");
    }

    private static async loadAssetsLibrary(): Promise<void> {
        await this.loadAssetsFolder("assets");
    }
}
