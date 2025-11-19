import { SystemEventEmitter, SystemEvent } from "../runtime/system-event.js";
import type { Canvas } from "../runtime/system.js";
import type { ILayer } from "../shared/ilayer.js";
import type { IRenderer } from "../shared/irenderer.js";
import { Rect } from "../shared/primitives.js";
import Vector2D from "../shared/vector2d.js";
import { DockSpace } from "./docking.js";
import { Project } from "./project/project.js";
import { Toolbar, ToolbarTab } from "./toolbar.js";
import Window from "./window.js";
import Viewport from "./windows/viewport.js";

class ToolBarActions {
    private constructor() { }

    public static async newProject() {
        try {
            Project.newProject(await window.showDirectoryPicker({ mode: "readwrite", id: "project" }));
        } catch (error) {
            console.error(`Error: ${error}`);
        }
    }

    public static async runProject() {
        Project.run();
    }
}

export default class Editor implements ILayer {
    private static dockSpace: DockSpace = new DockSpace(new Rect(0, 30, window.innerWidth, window.innerHeight));
    public canvas!: Canvas;
    public renderer!: IRenderer;
    public static readonly instance: Editor = new Editor();

    public static draggedItem: unknown | undefined;
    public readonly eventEmitter: SystemEventEmitter = new SystemEventEmitter(true, true);


    public static toolbar: Toolbar;
    public static runButton: ToolbarTab;

    public static viewportWindow: Viewport;

    private constructor() {
        this.eventEmitter.addEventListener(Editor.dockSpace.onEvent.bind(Editor.dockSpace));
    }


    public static init(): void {
        this.toolbar = new Toolbar();

        this.toolbar.addTab(new ToolbarTab("File", [new ToolbarTab("New project", ToolBarActions.newProject)]));
        this.toolbar.addTab(new ToolbarTab("Edit"));

        this.runButton = new ToolbarTab("Run", ToolBarActions.runProject);
        this.toolbar.tabs.push(this.runButton);

        this.instance.eventEmitter.addEventListener(Editor.toolbar.onEvent.bind(Editor.toolbar));

        this.viewportWindow = new Viewport(new Vector2D(200, 200), new Vector2D(300, 200));


        this.dockSpace.dockWindow(new Viewport(), this.dockSpace.root, "right", 0.8);
        this.dockSpace.dockWindow(new Viewport(), this.dockSpace.root, "bottom", 0.75);
        this.dockSpace.dockWindow(new Viewport(), this.dockSpace.root, "right", 0.8);
        this.dockSpace.dockWindow(this.viewportWindow, this.dockSpace.root, "full");

        //this.dockSpace.dockWindow(new Viewport(), this.dockSpace.root, "left");
        //this.dockSpace.dockWindow(new Viewport(), this.dockSpace.root, "bottom");
        //this.dockSpace.dockWindow(new Viewport(), this.dockSpace.root, "left");
    }

    public onAttach(): void { }

    public onUpdate(): void {
        Editor.dockSpace.root.rect.size.set(window.innerWidth, window.innerHeight);
        Editor.dockSpace.root.updateLayout();
        Editor.dockSpace.onUpdate();
        Editor.toolbar.onUpdate();

        Editor.runButton.button.position.x = window.innerWidth / 2 - Editor.runButton.button.rect.width / 2;
    }

    public onRender(): void {
        this.renderer.setCanvas(Editor.instance.canvas.element, Editor.instance.canvas.ctx);
        this.renderer.clearCanvas();

        Editor.dockSpace.onRender(this.renderer);
        Editor.toolbar.onRender(this.renderer);
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