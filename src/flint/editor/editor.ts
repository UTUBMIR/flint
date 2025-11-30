import Builder from "./project/builder";
import { Project } from "./project/project";
import Assets from "./windows/assets";
import HierarchyWindow from "./windows/hierarchy";
import InspectorWindow from "./windows/inspector";


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

    public static async openProject() {
        try {
            Project.openProject(await window.showDirectoryPicker({ mode: "readwrite", id: "project" }));
            Editor.onProjectLoad();
            Notifier.notify("Project loaded successfully.", "success");
        } catch (error) {
            console.error(`Error: ${error}`);
        }
    }

    public static async newProject() {
        try {
            Project.newProject(await window.showDirectoryPicker({ mode: "readwrite", id: "project" }));
            Editor.onProjectLoad();
            Notifier.notify("Project created successfully.", "success");
        } catch (error) {
            console.error(`Error: ${error}`);
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

    private constructor() { }


    public static init(): void {
        Builder.init();



        try {
            const addComponentDialog = document.getElementById("add-component-dialog")!;

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            Editor.hierarchyWindow = new HierarchyWindow(document.getElementById("hierarchy-tree")! as any);
            Editor.inspectorWindow = new InspectorWindow(document.getElementById("inspector-body")! as HTMLDivElement, addComponentDialog);

            Editor.assetsWindow = new Assets(document.getElementById("assets-window")! as HTMLDivElement, document.getElementById("assets-grid")! as HTMLDivElement);


            document.getElementById("open-project-button")!.addEventListener("click", ToolBarActions.openProject);
            document.getElementById("new-project-button")!.addEventListener("click", ToolBarActions.newProject);
            this.runButton = document.getElementById("run-button")! as HTMLButtonElement;

            this.runButton.addEventListener("click", ToolBarActions.runProject);

            document.getElementById("create-object-button")!.addEventListener("click", Editor.hierarchyWindow.createObject.bind(Editor.hierarchyWindow));

        } catch (error) {
            console.error(`Error: Failed to initialize UI: ${error}`);
        }

        Editor.hierarchyWindow.onUpdate(); //HACK: to get it working on ipad where its currently impossible to select folder for read/write
        Editor.updateInspectorFields();
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