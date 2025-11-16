import type { SystemEvent } from "../runtime/system-event.js";
import Input from "../shared/input.js";
import type { IRenderer } from "../shared/irenderer.js";
import { Rect } from "../shared/primitives.js";
import Vector2D from "../shared/vector2d.js";
import Editor from "./editor.js";

export class Drag {
    public rect: Rect;
    public dragOffset: Vector2D = new Vector2D();

    public hoveredCursor: string = "grab";
    public draggedCursor: string = "grabbing";

    public get position(): Vector2D {
        return this.rect.position;
    }
    public set position(value: Vector2D) {
        this.rect.position = value;
    }

    public get size(): Vector2D {
        return this.rect.size;
    }
    public set size(value: Vector2D) {
        this.rect.size = value;
    }

    public isDragged(): boolean {
        return Editor.draggedItem === this;
    }

    public constructor(rect?: Rect) {
        this.rect = rect ?? new Rect();
    }

    public onRender(r: IRenderer) {
        r.fillColor = "#f88";
        r.fillRect(this.position, this.size);
    }

    public onEvent(event: SystemEvent): void {
        event.stopImmediate = true;

        const isDown = event.type === "mousedown" || event.type === "touchstart";
        const isMove = event.type === "mousemove" || event.type === "touchmove";
        const isUp = event.type === "mouseup" || event.type === "touchend";

        if (isDown && Input.isMouseButtonPressed(0) && this.rect.contains(Input.mousePosition)) {
            this.dragOffset = this.position.subtract(Input.mousePosition);

            Editor.draggedItem = this;
            document.body.style.cursor = this.draggedCursor;
            this.onGrab();
            return;
        }

        if (isMove && !this.isDragged() && this.rect.contains(Input.mousePosition)) {
            document.body.style.cursor = this.hoveredCursor;
            return;
        }

        if (isMove && this.isDragged()) {
            this.position = Input.mousePosition.add(this.dragOffset);

            this.rect.clamp(
                new Rect(
                    new Vector2D(0, 0),
                    new Vector2D(window.innerWidth, window.innerHeight)
                )
            );
            document.body.style.cursor = this.draggedCursor;
            this.onGrabbing();
            return;
        }


        if (isUp && this.isDragged()) {
            Editor.draggedItem = undefined;
            this.onRelease();
            document.body.style.cursor = this.hoveredCursor;
            return;
        }

        event.stopImmediate = false;
    }

    public onGrab() { }
    public onGrabbing() { }
    public onRelease() { }
}