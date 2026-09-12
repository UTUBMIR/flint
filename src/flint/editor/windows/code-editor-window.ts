import { CodeEditor } from "../ui/code-editor";
import { BaseEditorWindow, type EditorWindowState, type WindowContext } from "../ui/window-framework";
import { System } from "@flint/runtime/system";

export default class CodeEditorWindow extends BaseEditorWindow {
    private readonly editorContainer: HTMLDivElement;
    private pendingState: EditorWindowState = undefined;

    public constructor(context: WindowContext) {
        super(context);
        this.root.className = "panel-content code-editor-panel";
        this.root.innerHTML = `<div class="flint-code-editor-container"></div>`;
        this.editorContainer = this.query(".flint-code-editor-container");
    }

    public override restoreState(state: EditorWindowState): void {
        this.pendingState = state;
    }

    public override serializeState(): EditorWindowState {
        const st = CodeEditor.getWindowState(this.instanceId);
        if (st && typeof st === "object" && (st as { currentPath?: string }).currentPath) return st;
        return this.pendingState;
    }

    public override async initialize(): Promise<void> {
        await CodeEditor.createWindow(
            this.instanceId,
            this.editorContainer,
            title => this.setTitle(title),
            this.context.container
        );
        const s = this.pendingState as { currentPath?: string; path?: string; tabs?: string[]; activeTabPath?: string } | undefined;
        const toOpen = s?.currentPath ?? s?.path ?? (s?.tabs?.[0] as string | undefined) ?? s?.activeTabPath;
        if (!toOpen) return;
        const tryOpen = async () => {
            if (!System.fileSystem?.started) {
                setTimeout(tryOpen, 150);
                return;
            }
            try {
                // Open all tabs that were saved, then focus the active one
                if (Array.isArray(s?.tabs) && s.tabs.length > 1) {
                    for (const p of s.tabs) {
                        if (p && p !== toOpen) await CodeEditor.openFile(p, this.instanceId);
                    }
                }
                await CodeEditor.openFile(toOpen, this.instanceId);
            } catch { /* ignore if file was deleted */ }
        };
        void tryOpen();
    }

    public override onActivate(): void {
        CodeEditor.activateWindow(this.instanceId);
    }

    public override dispose(): void {
        CodeEditor.destroyWindow(this.instanceId);
        super.dispose();
    }
}
