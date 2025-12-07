import GameObject from "../runtime/game-object";
import Layer from "../runtime/layer";
import Vector2D from "../shared/vector2d";
import Bundler from "./project/bundler";
import { Project } from "./project/project";
import Assets from "./windows/assets";
import HierarchyWindow, { editorName } from "./windows/hierarchy";
import InspectorWindow from "./windows/inspector";

import Camera from "../runtime/components/camera";
import Shape from "../runtime/components/shape";
import Transform from "../runtime/transform";

export type DropdownType = HTMLElement & {
    show: () => void;
    hide: () => void;
    reposition: () => void;
};

export class Notifier {
    public static escapeHtml(html: string) {
        const div = document.createElement("div");
        div.textContent = html;
        return div.innerHTML;
    }

    public static async notify(message: string, variant: "primary" | "success" | "neutral" | "warning" | "danger", duration = 4000) {
        const icons = {
            "primary": "info-circle",
            "success": "check2-circle",
            "neutral": "gear",
            "warning": "exclamation-triangle",
            "danger": "exclamation-octagon",
        };

        const alert = Object.assign(document.createElement("sl-alert"), {
            countdown: "ltr",
            variant,
            closable: true,
            duration: duration,
            innerHTML: `
        <sl-icon name="${icons[variant]}" slot="icon"></sl-icon>
        ${this.escapeHtml(message)}
      `
        });

        document.body.append(alert);
        await customElements.whenDefined("sl-alert");

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (alert as any).toast();
    }
}

class ToolBarActions {
    private constructor() { }

    public static async newProject() {
        await Project.newProject(await window.showDirectoryPicker({ mode: "readwrite", id: "project" }));
        Editor.onProjectLoad();
        Notifier.notify("Project created successfully.", "success");
    }

    public static async openProject() {
        await Project.openProject(await window.showDirectoryPicker({ mode: "readwrite", id: "project" }));
        Editor.onProjectLoad();
        Notifier.notify("Project loaded successfully.", "success");
    }

    public static async saveProject() {
        try {
            await Project.saveProject();
            Notifier.notify("Project saved successfully.", "success");
        }
        catch (e: unknown) {
            Notifier.notify("Could not save the project: " + e, "warning");
        }
    }


    public static async runProject() {
        if (await Project.run()) {
            Notifier.notify("Project started.", "primary");
        }
    }
}


export default class Editor {
    public static draggedItem: unknown | undefined;

    public static hierarchyWindow: HierarchyWindow;
    public static inspectorWindow: InspectorWindow;
    public static assetsWindow: Assets;

    public static runButton: HTMLButtonElement;

    public static loadingDialog: HTMLElement & { show: () => void, hide: () => void };
    public static loadingDialogProgressBar: HTMLElement & { value: number, indeterminate: boolean };


    private static _defaultLayer: Layer;

    public static get defaultLayer(): Layer {
        return this._defaultLayer;
    }

    private constructor() { }


    public static init(): void {
        Bundler.init();

        try {
            const addComponentDialog = document.getElementById("add-component-dialog")!;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Editor.hierarchyWindow = new HierarchyWindow(document.getElementById("hierarchy-tree")! as any);
            Editor.inspectorWindow = new InspectorWindow(document.getElementById("inspector-body")! as HTMLDivElement, addComponentDialog);

            Editor.assetsWindow = new Assets(document.getElementById("assets-window")! as HTMLDivElement, document.getElementById("assets-grid")! as HTMLDivElement);

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Editor.loadingDialog = document.getElementById("loading-dialog")! as any;
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Editor.loadingDialog.addEventListener("sl-request-close", function (event: any) {
                if (event.detail.source === "overlay") {
                    event.preventDefault();
                }
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Editor.loadingDialogProgressBar = Editor.loadingDialog.querySelector("sl-progress-bar")! as any;

            document.getElementById("new-project-button")!.addEventListener("click", ToolBarActions.newProject);
            document.getElementById("open-project-button")!.addEventListener("click", ToolBarActions.openProject);

            document.getElementById("save-project-button")!.addEventListener("click", ToolBarActions.saveProject);
            document.addEventListener("keydown", async function (event) {
                if (event.ctrlKey && event.code === "KeyS") {
                    event.preventDefault();
                    event.stopImmediatePropagation();
                    await ToolBarActions.saveProject();
                }
            }, true);

            this.runButton = document.getElementById("run-button")! as HTMLButtonElement;

            this.runButton.addEventListener("click", ToolBarActions.runProject);

            document.getElementById("create-object-button")!.addEventListener("click", Editor.hierarchyWindow.createObject.bind(Editor.hierarchyWindow));

        } catch (error) {
            console.error(`Error: Failed to initialize UI: ${error}`);
        }

        Editor.hierarchyWindow.onUpdate(); //FIXME: why is this even needed?
        Editor.updateInspectorFields();
        Editor.loadEngineFiles();

        Editor._defaultLayer = new Layer();
        Editor._defaultLayer.addObject(new GameObject([
            new Shape()
        ], new Transform(
            undefined,
            new Vector2D(100, 100)
        )));

        Editor._defaultLayer.addObject(new GameObject([
            new Camera()
        ]));

        editorName("New Layer")(Layer);
        editorName("New GameObject")(GameObject);
    }

    public static async loadEngineFiles() {
        const fileList = await fetch(window.location.origin + "/types/" + "files.json").then(r => r.json());
        const fileBaseUrl = window.location.origin + "/src/";

        const allFiles: string[] = [
            ...(fileList.types || []),
            ...(fileList.json || [])
        ];

        const tasks: Promise<void>[] = [];

        for (const filePath of allFiles) {
            tasks.push((async () => {
                const thisFile = filePath.replace("d.ts", "ts");
                const url = fileBaseUrl + thisFile;
                const content = await fetch(url).then(r => r.text());

                Bundler.flintFiles.set(thisFile, content);
            })());
        }
        await Promise.all(tasks);

        console.log("All flint files loaded");
    }

    public static updateInspectorFields() {
        Editor.inspectorWindow.update();
        requestAnimationFrame(Editor.updateInspectorFields);
    }

    public static onProjectLoad() {
        Editor.runButton.disabled = false;
        // Editor.hierarchy.onUpdate();
    }
}