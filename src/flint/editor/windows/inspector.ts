/* eslint-disable @typescript-eslint/no-explicit-any */
import type GameObject from "../../runtime/game-object";
import type Component from "../../runtime/component";
import { System, type UUID } from "../../runtime/system";
import Metadata, { MetadataKeys } from "../../shared/metadata";
import { ComponentBuilder } from "../component-builder";
import { CasingHandler } from "../casing-handler";
import { BaseEditorWindow, type EditorWindowControl, type EditorWindowState, type WindowContext } from "../window-framework";
import { Notifier } from "../editor";

class InspectorComponent {
    public readonly element: HTMLElement;
    private allowDrag = false;

    public constructor(public readonly component: Component) {
        this.element = Object.assign(document.createElement("sl-details"), {
            summary: this.getDisplayName(component),
            open: true,
            draggable: true
        });

        this.element.addEventListener("mousedown", event => {
            const path = event.composedPath();
            this.allowDrag = path.some(item => item instanceof HTMLElement && item.getAttribute?.("part") === "summary");
        }, true);

        this.element.addEventListener("dragstart", event => {
            if (!this.allowDrag) {
                event.preventDefault();
                return;
            }

            event.dataTransfer!.setData("application/x-component-ref", JSON.stringify({
                name: System.getComponentName(component),
                id: component.gameObject.id
            }));
        });

        this.element.addEventListener("dragend", () => {
            this.allowDrag = false;
        });

        this.generateContent();
    }

    public generateContent(): void {
        this.element.appendChild(ComponentBuilder.build(this.component));
    }

    private getDisplayName(component: Component): string {
        return Metadata.getClass(component, MetadataKeys.EditorName)
            ?? System.getComponentName(component);
    }
}

export default class InspectorWindow extends BaseEditorWindow {
    private readonly bodyElement: HTMLDivElement;
    private readonly dropTarget: HTMLDivElement;
    private readonly addComponentButton: HTMLButtonElement;
    private currentObjectId: UUID | null = null;
    private followingSelection = true;
    private components: InspectorComponent[] = [];
    private readonly dialog: HTMLElement & { show: () => void; hide: () => void };
    private readonly dialogSelect: HTMLSelectElement;
    private readonly dialogAddButton: HTMLButtonElement;

    public constructor(context: WindowContext) {
        super(context);

        this.root.className = "panel-content";
        this.root.innerHTML = `
            <div class="panel-body inspector-panel-body" data-role="drop-target">
                <div data-role="inspector-body"></div>
                <sl-button data-role="add-component-button">Add component</sl-button>
            </div>
        `;

        this.bodyElement = this.query('[data-role="inspector-body"]');
        this.dropTarget = this.query('[data-role="drop-target"]');
        this.addComponentButton = this.query('[data-role="add-component-button"]');
        this.dialog = document.getElementById("add-component-dialog")! as HTMLElement & { show: () => void; hide: () => void };
        this.dialogSelect = this.dialog.getElementsByTagName("sl-select")[0] as unknown as HTMLSelectElement;
        this.dialogAddButton = this.dialog.getElementsByTagName("sl-button")[0] as unknown as HTMLButtonElement;
    }

    public override initialize(): void {
        this.listen(this.dropTarget, "dragover", event => {
            event.preventDefault();
        });

        this.listen(this.dropTarget, "drop", event => {
            const componentName = event.dataTransfer?.getData("application/x-component-name") ?? "";
            if (componentName.length === 0) {
                return;
            }

            event.preventDefault();
            this.currentObject?.addComponent(new (System.components.get(componentName) as any)());
        });

        this.listen(this.addComponentButton, "click", () => {
            void this.addComponent();
        });

        this.listen(this.dialogSelect, "sl-change" as keyof HTMLElementEventMap, () => {
            this.dialogAddButton.disabled = false;
        });

        this.listen(this.dialogAddButton, "click", () => {
            this.dialog.hide();
            if (!this.currentObject) {
                return;
            }

            const component = System.components.get(this.dialogSelect.value);
            if (!component) {
                return;
            }

            this.currentObject.addComponent(new (component as any)());
        });

        this.registerCleanup(this.context.services.selection.subscribe(selectedId => {
            if (this.followingSelection) {
                this.setTargetId(selectedId);
            }
        }));

        this.refreshControls();
        this.renderCurrentObject();
    }

    public override serializeState(): EditorWindowState {
        return {
            currentObjectId: this.currentObjectId,
            followingSelection: this.followingSelection
        };
    }

    public override getControls(): readonly EditorWindowControl[] {
        return [{
            id: "inspector-lock",
            icon: this.followingSelection ? "unlock-fill" : "lock-fill",
            title: this.followingSelection
                ? "Lock inspector to current object"
                : "Unlock inspector to follow selection",
            ariaLabel: this.followingSelection ? "Lock inspector" : "Unlock inspector",
            active: !this.followingSelection,
            onClick: () => this.toggleFollowSelection()
        }];
    }

    private toggleFollowSelection(): void {
        this.followingSelection = !this.followingSelection;
        if (this.followingSelection) {
            this.setTargetId(this.context.services.selection.getSelectedId());
        }
        this.refreshControls();
    }

    public override restoreState(state: EditorWindowState): void {
        this.followingSelection = state?.followingSelection !== false;
        const currentObjectId = state?.currentObjectId;
        if (typeof currentObjectId === "string") {
            this.currentObjectId = currentObjectId as UUID;
        } else if (this.followingSelection) {
            this.currentObjectId = this.context.services.selection.getSelectedId();
        }
        this.refreshControls();
    }

    public get currentObject(): GameObject | undefined {
        return this.currentObjectId && System.world ? System.world.getGameObjectById(this.currentObjectId) : undefined;
    }

    public set currentObject(object: GameObject | undefined) {
        this.setTargetId(object?.id ?? null);
    }

    private setTargetId(id: UUID | null): void {
        this.currentObjectId = id;
        this.renderCurrentObject();
    }

    public async addComponent(): Promise<void> {
        if (!this.currentObject) {
            await Notifier.notify("Select object first.", "primary");
            return;
        }

        this.dialogAddButton.disabled = true;
        this.dialogSelect.innerHTML = "";

        for (const [name, component] of System.components) {
            this.dialogSelect.append(Object.assign(document.createElement("sl-option"), {
                value: name,
                textContent: CasingHandler.splitPascalCase(
                    Metadata.getClass(component.prototype, MetadataKeys.EditorName, false) ?? name
                )
            }));
        }

        this.dialogSelect.setAttribute("value", "");
        this.dialog.show();
    }

    private renderCurrentObject(): void {
        const currentObject = this.currentObject;
        if (!currentObject) {
            this.bodyElement.innerHTML = "";
            this.addComponentButton.style.display = "none";
            this.components = [];
            return;
        }

        this.bodyElement.innerHTML = "";
        this.addComponentButton.style.display = "initial";
        ComponentBuilder.clearFields();
        this.components = [];

        this.addInspectorComponent(currentObject.transform as Component);
        for (const component of currentObject.getAllComponents()) {
            this.addInspectorComponent(component);
        }
    }

    private addInspectorComponent(component: Component): void {
        const inspectorComponent = new InspectorComponent(component);
        this.bodyElement.appendChild(inspectorComponent.element);
        this.components.push(inspectorComponent);
    }

    private componentsMatch(): boolean {
        const currentObject = this.currentObject;
        if (!currentObject) {
            return false;
        }

        const expected: Component[] = [currentObject.transform, ...currentObject.getAllComponents()];
        if (expected.length !== this.components.length) {
            return false;
        }

        for (let i = 0; i < expected.length; ++i) {
            if (this.components[i]!.component !== expected[i]) {
                return false;
            }
        }

        return true;
    }

    public update(): void {
        if (!this.currentObject) {
            return;
        }

        if (!this.componentsMatch()) {
            this.renderCurrentObject();
        }

        ComponentBuilder.updateFields();
    }
}
