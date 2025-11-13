import type { Canvas } from "../runtime/system.js";
import type { ILayer } from "../shared/ilayer.js";
import type { IRenderer } from "../shared/irenderer.js";
import Vector2D from "../shared/vector2d.js";
import Window from "./window.js";

export default class Editor implements ILayer {
    private static windows: Window[] = [];
    public canvas!: Canvas;
    public renderer!: IRenderer;
    public static readonly instance: Editor = new Editor();
    public static draggedWindow?: Window;

    private constructor() { }

    public static init(): void {
        this.pushWindow(new Window(new Vector2D(200, 200), new Vector2D(200, 600)));
    }

    public onAttach(): void { }

    public onUpdate(): void {
        for (const window of Editor.windows) window.onUpdate();
    }

    public onRender(): void {
        this.renderer.setCanvas(Editor.instance.canvas.element, Editor.instance.canvas.ctx);
        this.renderer.clearCanvas();
        for (const window of Editor.windows) window.onRender(Editor.instance.renderer);
    }

    public static pushWindow(window: Window) {
        Editor.windows.push(window);
    }
}