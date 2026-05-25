import { CodeEditor } from "../ui/code-editor";
import { BaseEditorWindow, type WindowContext } from "../ui/window-framework";

export default class CodeEditorWindow extends BaseEditorWindow {
    private readonly editorContainer: HTMLDivElement;

    public constructor(context: WindowContext) {
        super(context);
        this.root.className = "panel-content code-editor-panel";
        this.root.innerHTML = `<div class="flint-code-editor-container"></div>`;
        this.editorContainer = this.query(".flint-code-editor-container");
    }

    public override async initialize(): Promise<void> {
        await CodeEditor.createWindow(
            this.instanceId,
            this.editorContainer,
            title => this.setTitle(title),
            this.context.container
        );
    }

    public override onActivate(): void {
        CodeEditor.activateWindow(this.instanceId);
    }

    public override dispose(): void {
        CodeEditor.destroyWindow(this.instanceId);
        super.dispose();
    }
}
