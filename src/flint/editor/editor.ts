import { SystemEventEmitter, SystemEvent } from "../runtime/system-event.js";
import type { Canvas } from "../runtime/system.js";
import type { ILayer } from "../shared/ilayer.js";
import type { IRenderer } from "../shared/irenderer.js";
import Vector2D from "../shared/vector2d.js";
import Window from "./window.js";
import Viewport from "./windows/viewport.js";

export default class Editor implements ILayer {
    private static windows: Window[] = [];
    public canvas!: Canvas;
    public renderer!: IRenderer;
    public static readonly instance: Editor = new Editor();
    public static draggedWindow: Window | undefined;
    public static resizedWindow: Window | undefined;
    public readonly eventEmitter: SystemEventEmitter = new SystemEventEmitter(true, true);

    public static viewportWindow: Viewport;

    private constructor() { }


    public static init(): void {
        this.viewportWindow = new Viewport(new Vector2D(200, 200), new Vector2D(300, 200));
        this.pushWindow(this.viewportWindow);
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

    public static pushWindow(window: Window): void {
        Editor.windows.push(window);
        this.instance.eventEmitter.addEventListener(window.onEvent.bind(window));

        window.onAttach();
    }

    public onEvent(event: SystemEvent): void {
        if (this.eventEmitter.dispatchEvent(event.type)) {
            document.body.style.cursor = "initial";
        }
    }

    public static moveWindowUp(window: Window): void {
        const index = this.windows.indexOf(window);

        if (index != -1) {
            this.windows.splice(index, 1);
            this.windows.push(window);
            this.instance.eventEmitter.removeEventListener(window.onEvent);
            this.instance.eventEmitter.addEventListener(window.onEvent.bind(window));
        }
    }
}