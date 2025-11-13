import type { SystemEvent } from "../runtime/system-event.js";
import Input from "../shared/input.js";
import type { IRenderer } from "../shared/irenderer.js";
import Vector2D from "../shared/vector2d.js";
import Editor from "./editor.js";

const windowColor = "#292e4a";
const windowEdgeColor = "#5d68a8";
const windowShadowColor = "#3446a8";

export default class Window {
    public position: Vector2D;
    public size: Vector2D;
    public dragOffset: Vector2D = new Vector2D();

    public constructor(position?: Vector2D, size?: Vector2D) {
        this.position = position ?? new Vector2D();
        this.size = size ?? new Vector2D(100, 100);
        this.constrainPosition();
    }

    public onAttach() {

    }

    public onUpdate() {

    }

    public onRender(renderer: IRenderer) {
        renderer.fillColor = windowColor;
        renderer.lineColor = windowEdgeColor;
        renderer.lineWidth = 5;
        renderer.lineJoin = "bevel";

        renderer.shadowColor = windowShadowColor;
        renderer.shadowBlur = 20;

        renderer.strokeRect(this.position, this.size);
        renderer.rect(this.position, this.size);
    }

    public onEvent(event: SystemEvent): void {
        event.stopImmediate = true;

        if ((event.type === "mousedown" || event.type === "touchstart") && this.isHovered()) {
            this.dragOffset = this.position.subtract(Input.mousePosition);
            Editor.draggedWindow = this;
            Editor.moveWindowUp(this);
        }
        else if ((event.type === "mousemove" || event.type === "touchmove") && Editor.draggedWindow === this) {
            this.position = Input.mousePosition.add(this.dragOffset);
            this.constrainPosition();
        }
        else if ((event.type === "mouseup" || event.type === "touchend") && Editor.draggedWindow === this) {
            Editor.draggedWindow = undefined;
        } else {
            event.stopImmediate = false;
        }
    }

    private isHovered(): boolean {
        if (Input.mousePosition.x >= this.position.x && Input.mousePosition.x <= this.position.x + this.size.x) {
            if (Input.mousePosition.y >= this.position.y && Input.mousePosition.y <= this.position.y + this.size.y) {
                return true;
            }
        }
        return false;
    }

    private constrainPosition() {
        this.position.x = Math.min(Math.max(this.position.x, 0), window.innerWidth - this.size.x);
        this.position.y = Math.min(Math.max(this.position.y, 0), window.innerHeight - this.size.y);
    }
}