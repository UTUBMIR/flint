import Vector2D from "../../shared/vector2d";
import type GameObject from "../../runtime/game-object";
export default class Inspector {
    protected minSize: Vector2D;
    currentObject: GameObject | undefined;
    private components;
    private dropTarget;
    private element;
    private dialog;
    private dialogSelect;
    private addComponentButton;
    private dialogAddButton;
    constructor(element: HTMLDivElement, dialog: HTMLElement);
    addComponent(): Promise<void>;
    private addInspectorComponent;
    onEvent(event: Event): void;
    private componentsMatch;
    update(): void;
}
