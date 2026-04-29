import { System } from "../../runtime/system";
import { BaseEditorWindow, type WindowContext } from "../window-framework";

export default class ViewportWindow extends BaseEditorWindow {
    private readonly viewportRoot: HTMLDivElement;

    public constructor(context: WindowContext) {
        super(context);
        this.root.className = "panel-content viewport-panel";
        this.root.innerHTML = `<div class="flint-viewport-root"></div>`;
        this.viewportRoot = this.query(".flint-viewport-root");
    }

    public override initialize(): void {
        if (!document.getElementById("root")) {
            this.viewportRoot.id = "root";
        }
    }

    public override onActivate(): void {
        System.setRootElement(this.viewportRoot);
    }
}
