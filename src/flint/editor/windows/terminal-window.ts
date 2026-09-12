import { TerminalProvider } from "../ui/terminal-provider";
import { BaseEditorWindow, type WindowContext } from "../ui/window-framework";

export default class TerminalWindow extends BaseEditorWindow {
    private readonly terminalContainer: HTMLDivElement;

    public constructor(context: WindowContext) {
        super(context);
        this.root.className = "panel-content flint-terminal-panel";
        this.root.innerHTML = `<div class="flint-terminal-container"></div>`;
        this.terminalContainer = this.query(".flint-terminal-container");
    }

    public override async initialize(): Promise<void> {
        await TerminalProvider.createWindow(
            this.instanceId,
            this.terminalContainer,
            title => this.setTitle(title),
            this.context.container
        );
    }

    public override onActivate(): void {
        TerminalProvider.activateWindow(this.instanceId);
    }

    public override dispose(): void {
        TerminalProvider.destroyWindow(this.instanceId);
        super.dispose();
    }
}
