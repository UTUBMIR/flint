import { SystemEventEmitter, SystemEvent } from "../runtime/system-event.js";
import type { Canvas } from "../runtime/system.js";
import type { ILayer } from "../shared/ilayer.js";
import Input from "../shared/input.js";
import type { IRenderer } from "../shared/irenderer.js";
import Vector2D from "../shared/vector2d.js";
import DockContainer from "./dock-container.js";
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
        this.addWindow(this.viewportWindow);
        this.addWindow(new Viewport(new Vector2D(600, 200), new Vector2D(300, 200)));

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

    public static addWindow(window: Window): void {
        Editor.windows.push(window);
        this.instance.eventEmitter.addEventListener(window.onEvent.bind(window));

        window.onAttach();
    }

    public static removeWindow(window: Window): boolean {
        const index = this.windows.indexOf(window);
        if (index !== -1) {
            this.windows.splice(index, 1);
            this.instance.eventEmitter.removeEventListener(window.onEvent);
            return true;
        }
        return false;
    }

    public onEvent(event: SystemEvent): void {
        if (this.eventEmitter.dispatchEvent(new SystemEvent(event.type, event.data))) {
            document.body.style.cursor = "initial";
        }
    }

    public static moveWindowUp(window: Window): void {
        if (this.removeWindow(window)) {

            this.windows.push(window);
            this.instance.eventEmitter.addEventListener(window.onEvent.bind(window));
        }
    }

    public static tryDock(dragged: Window) {
        for (const other of Editor.windows) {

            if (other === dragged) continue;

            const mx = Input.mousePosition.x;
            const my = Input.mousePosition.y;

            const insideX = mx >= other.position.x && mx <= other.position.x + other.size.x;
            const insideTitleBar = my >= other.position.y && my <= other.position.y + Window.titleBarHeight;

            if (insideX && insideTitleBar) {
                return other;
            }
        }

        return undefined;
    }


    public static createDockContainer(a: Window, b: Window) {
        const dock = new DockContainer(a.position.copy(), a.size.copy());

        dock.addWindow(b);
        dock.addWindow(a);

        this.removeWindow(b);
        this.removeWindow(a);
        this.addWindow(dock);
    }

}