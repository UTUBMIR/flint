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
    public static readonly borderWidth = 5;
    private static readonly minSize = new Vector2D(100, 100);
    private resize = 0;
    private resizeSide = 0;

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
        renderer.lineWidth = Window.borderWidth;
        renderer.lineJoin = "bevel";

        renderer.shadowColor = windowShadowColor;
        renderer.shadowBlur = 20;

        renderer.strokeRect(this.position, this.size);
        renderer.rect(this.position, this.size);
    }

    public onEvent(event: SystemEvent): void {
        event.stopImmediate = true;

        const isDown = event.type === "mousedown" || event.type === "touchstart";
        const isMove = event.type === "mousemove" || event.type === "touchmove";
        const isUp = event.type === "mouseup" || event.type === "touchend";

        if (Editor.resizedWindow !== this) {
            this.resize = this.hoveredToResize();
        }

        if (isDown && this.isInside() && this.resize === 0) {
            this.dragOffset = this.position.subtract(Input.mousePosition);
            Editor.draggedWindow = this;
            Editor.moveWindowUp(this);
            return;
        }

        if (isDown && this.resize !== 0) {
            this.dragOffset = this.position.add(this.size);
            Editor.resizedWindow = this;
            Editor.moveWindowUp(this);
            return;
        }

        if (isMove && Editor.draggedWindow === this) {
            this.position = Input.mousePosition.add(this.dragOffset);
            this.constrainPosition();
            return;
        }

        if (isMove && Editor.resizedWindow === this) {
            this.applyResize();
            return;
        }

        if (isMove && this.resize !== 0) {
            this.applyCursor();
            return;
        }

        if (isUp && (Editor.draggedWindow === this || Editor.resizedWindow === this)) {
            Editor.draggedWindow = undefined;
            Editor.resizedWindow = undefined;
            return;
        }

        event.stopImmediate = false;
    }

    private isInside(): boolean {
        return (
            Input.mousePosition.x >= this.position.x &&
            Input.mousePosition.x <= this.position.x + this.size.x &&
            Input.mousePosition.y >= this.position.y &&
            Input.mousePosition.y <= this.position.y + this.size.y
        );
    }

    private hoveredToResize(): number {
        const { x, y } = this.position;
        const { x: w, y: h } = this.size;
        const { x: mx, y: my } = Input.mousePosition;
        const b = Window.borderWidth;

        if (mx < x - b || mx > x + w + b ||
            my < y - b || my > y + h + b
        ) {
            return 0;
        }

        const left = mx >= x - b && mx <= x;
        const right = mx >= x + w && mx <= x + w + b;
        const top = my >= y - b && my <= y;
        const bottom = my >= y + h && my <= y + h + b;

        // Corners (diagonals)
        if (left && top) return this.setResize(3, 0);
        if (right && top) return this.setResize(4, 0);
        if (right && bottom) return this.setResize(3, 1);
        if (left && bottom) return this.setResize(4, 1);

        // Edges
        if (left || right) return this.setResize(1, left ? 0 : 1);
        if (top || bottom) return this.setResize(2, top ? 0 : 1);

        return 0;
    }

    private setResize(type: number, side: number): number {
        this.resizeSide = side;
        return type;
    }



    private applyResize(): void {
        const mx = Input.mousePosition.x;
        const my = Input.mousePosition.y;

        const x = this.position.x;
        const y = this.position.y;
        const right = x + this.size.x;
        const bottom = y + this.size.y;

        const leftSide = this.resizeSide === 0;
        const topSide = this.resizeSide === 0;

        switch (this.resize) {

            // LEFT / RIGHT
            case 1:
                if (leftSide) {
                    this.position.x = mx;
                    this.size.x = right - mx;
                } else {
                    this.size.x = mx - x;
                }
                break;

            // TOP / BOTTOM
            case 2:
                if (topSide) {
                    this.position.y = my;
                    this.size.y = bottom - my;
                } else {
                    this.size.y = my - y;
                }
                break;

            // TOP-LEFT / BOTTOM-RIGHT
            case 3:
                if (leftSide) {
                    this.position.x = mx;
                    this.size.x = right - mx;
                    this.position.y = my;
                    this.size.y = bottom - my;
                } else {
                    this.size.x = mx - x;
                    this.size.y = my - y;
                }
                break;

            // TOP-RIGHT / BOTTOM-LEFT
            case 4:
                if (leftSide) {
                    this.position.y = my;
                    this.size.y = bottom - my;
                    this.size.x = mx - x;
                } else {
                    this.position.x = mx;
                    this.size.x = right - mx;
                    this.size.y = my - y;
                }
                break;
        }
        if (this.size.x < Window.minSize.x) {
            this.size.x = Window.minSize.x;
        }
        if (this.size.y < Window.minSize.y) {
            this.size.y = Window.minSize.y;
        }
    }



    private applyCursor(): void {
        const cursors: Record<number, string> = {
            1: "w-resize",
            2: "s-resize",
            3: "se-resize",
            4: "sw-resize",
        };

        document.body.style.cursor = cursors[this.resize] ?? "inerhit";
    }




    private constrainPosition() {
        this.position.x = Math.min(Math.max(this.position.x, 0), window.innerWidth - this.size.x);
        this.position.y = Math.min(Math.max(this.position.y, 0), window.innerHeight - this.size.y);
    }
}