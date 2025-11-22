import { SystemEventEmitter, SystemEvent } from "../runtime/system-event.js";
import { System, type Canvas } from "../runtime/system.js";
import type { ILayer } from "../shared/ilayer.js";
import type { IRenderer } from "../shared/irenderer.js";
import { Rect } from "../shared/primitives.js";
import Vector2D from "../shared/vector2d.js";
import { DockNode, DockSpace } from "./docking.js";
import Builder from "./project/builder.js";
import { Project } from "./project/project.js";
import { Toolbar, ToolbarTab } from "./toolbar.js";
import Window from "./window.js";
import Hierarchy from "./windows/hierarchy.js";
import Inspector from "./windows/inspector.js";
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
    public static hierarchyWindow: Hierarchy;

    private constructor() {
        this.eventEmitter.addEventListener(Editor.dockSpace.onEvent.bind(Editor.dockSpace));
    }


    public static init(): void {
        Builder.init();
        this.toolbar = new Toolbar();

        this.toolbar.addTab(new ToolbarTab("File", [new ToolbarTab("New project", ToolBarActions.newProject)]));
        this.toolbar.addTab(new ToolbarTab("Edit"));

        this.runButton = new ToolbarTab("Run", ToolBarActions.runProject);
        this.toolbar.tabs.push(this.runButton);

        this.instance.eventEmitter.addEventListener(Editor.toolbar.onEvent.bind(Editor.toolbar));

        this.viewportWindow = new Viewport();
        this.hierarchyWindow = new Hierarchy();


        this.dockWindow(new Inspector(), this.dockSpace.root, "right", 0.8);
        this.dockWindow(new Viewport(), this.dockSpace.root, "bottom", 0.75);
        this.dockWindow(this.hierarchyWindow, this.dockSpace.root, "right", 0.8);
        this.dockWindow(this.viewportWindow, this.dockSpace.root, "full");

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

    public static dockWindow(window: Window, target: DockNode, side: "left" | "right" | "top" | "bottom" | "full", ratio: number = 0.5): void {
        this.dockSpace.dockWindow(window, this.dockSpace.root, side, ratio);
        window.onAttach();
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
        System.setCursor("initial");
        this.eventEmitter.dispatchEvent(new SystemEvent(event.type));
    }
}