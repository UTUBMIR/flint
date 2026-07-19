declare module "monaco-editor" {
    export interface ITextModel {
        getValue(): string;
        getLineContent(line: number): string;
        getLineCount(): number;
        getValueInRange(range: { startLineNumber: number; startColumn: number; endLineNumber: number; endColumn: number }): string;
        getWordUntilPosition(position: { lineNumber: number; column: number }): { word: string; startColumn: number; endColumn: number };
        onDidChangeContent(callback: () => void): void;
    }

    export interface IStandaloneCodeEditor {
        getModel(): ITextModel | null;
        setModel(model: ITextModel | null): void;
        focus(): void;
        addCommand(keybinding: number, handler: () => void): void;
    }

    export interface Languages {
        typescript: {
            typescriptDefaults: {
                setCompilerOptions(options: unknown): void;
                setDiagnosticsOptions(options: unknown): void;
                setMaximumWorkerIdleTime(ms: number): void;
                addExtraLib(content: string, path: string): void;
            };
            javascriptDefaults: {
                addExtraLib(content: string, path: string): void;
            };
            ScriptTarget: { ESNext: unknown };
            ModuleKind: { ESNext: unknown };
            ModuleResolutionKind: { NodeJs: unknown };
        };
        registerCompletionItemProvider(language: string, provider: unknown): void;
        CompletionItemKind: { Module: unknown; Class: unknown; Folder: unknown };
    }

    export interface Editor {
        create(container: HTMLElement, options?: unknown): IStandaloneCodeEditor;
        createModel(value: string, language: string): ITextModel;
        setTheme(theme: string): void;
    }

    export interface Position {
        lineNumber: number;
        column: number;
    }

    export interface IRange {
        startLineNumber: number;
        startColumn: number;
        endLineNumber: number;
        endColumn: number;
    }
}

declare global {
    interface Window {
        monaco: {
            languages: import("monaco-editor").Languages;
            editor: import("monaco-editor").Editor;
            KeyMod: { CtrlCmd: number; Shift: number; Alt: number; WinCtrl: number; chord(firstPart: number, secondPart: number): number };
            KeyCode: { KeyS: number; [key: string]: number };
        };
    }
}

export {};