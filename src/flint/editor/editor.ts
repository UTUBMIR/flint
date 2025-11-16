import { SystemEventEmitter, SystemEvent } from "../runtime/system-event.js";
import type { Canvas } from "../runtime/system.js";
import type { ILayer } from "../shared/ilayer.js";
import type { IRenderer } from "../shared/irenderer.js";
import { Rect } from "../shared/primitives.js";
import Vector2D from "../shared/vector2d.js";
import { DockSpace } from "./docking.js";
import Window from "./window.js";
import Viewport from "./windows/viewport.js";

export default class Editor implements ILayer {
    private static dockSpace: DockSpace = new DockSpace(new Rect(0, 30, window.innerWidth, window.innerHeight));
    public canvas!: Canvas;
    public renderer!: IRenderer;
    public static readonly instance: Editor = new Editor();

    public static draggedItem: unknown | undefined;
    public readonly eventEmitter: SystemEventEmitter = new SystemEventEmitter(true, true);

    public static viewportWindow: Viewport;

    private constructor() {
        this.eventEmitter.addEventListener(Editor.dockSpace.event.bind(Editor.dockSpace));
    }


    public static init(): void {
        this.viewportWindow = new Viewport(new Vector2D(200, 200), new Vector2D(300, 200));

        this.dockSpace.dockWindow(new Viewport(), this.dockSpace.root, "right", 0.8);
        this.dockSpace.dockWindow(new Viewport(), this.dockSpace.root, "bottom", 0.75);
        this.dockSpace.dockWindow(this.viewportWindow, this.dockSpace.root, "left", 0.8);
        this.dockSpace.dockWindow(new Viewport(), this.dockSpace.root, "full", 0.7);

        //this.dockSpace.dockWindow(new Viewport(), this.dockSpace.root, "left");
        //this.dockSpace.dockWindow(new Viewport(), this.dockSpace.root, "bottom");
        //this.dockSpace.dockWindow(new Viewport(), this.dockSpace.root, "left");
    }

    public onAttach(): void { }

    public onUpdate(): void {
        Editor.dockSpace.root.rect.size.set(window.innerWidth, window.innerHeight);
        Editor.dockSpace.root.updateLayout();
        Editor.dockSpace.update();
    }

    public onRender(): void {
        this.renderer.setCanvas(Editor.instance.canvas.element, Editor.instance.canvas.ctx);
        this.renderer.clearCanvas();

        Editor.dockSpace.render(this.renderer);
    }

    public static addWindow(window: Window): void {
        // Editor.dockSpace.dockWindow(window, Editor.dockSpace.root, "left");
        // this.instance.eventEmitter.addEventListener(window.onEvent.bind(window));

        // window.onAttach();
    }

    public static removeWindow(window: Window): boolean {
        // const index = this.windows.indexOf(window);
        // if (index !== -1) {
        //     this.windows.splice(index, 1);
        //     this.instance.eventEmitter.removeEventListener(window.onEvent);
        //     return true;
        // }
        return false;
    }

    public onEvent(event: SystemEvent): void {
        document.body.style.cursor = "initial";
        this.eventEmitter.dispatchEvent(new SystemEvent(event.type));
    }
}