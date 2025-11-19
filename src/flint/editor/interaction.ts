import type { SystemEvent } from "../runtime/system-event.js";
import Input from "../shared/input.js";
import type { IRenderer } from "../shared/irenderer.js";
import { Rect } from "../shared/primitives.js";
import Vector2D from "../shared/vector2d.js";
import Editor from "./editor.js";
import visualsConfig from "./config/visuals.json" with { type: 'json' };
import type { Color } from "../shared/graphics.js";


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
        const isDown = event.type === "mousedown" || event.type === "touchstart";
        const isMove = event.type === "mousemove" || event.type === "touchmove";
        const isUp = event.type === "mouseup" || event.type === "touchend";

        if (isDown && Input.isMouseButtonPressed(0) && this.rect.contains(Input.mousePosition)) {
            this.dragOffset = this.position.subtract(Input.mousePosition);

            Editor.draggedItem = this;
            document.body.style.cursor = this.draggedCursor;
            this.onGrab();

            event.stopImmediatePropagation();
            return;
        }

        if (isMove && !this.isDragged() && this.rect.contains(Input.mousePosition)) {
            document.body.style.cursor = this.hoveredCursor;

            event.stopImmediatePropagation();
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

            event.stopImmediatePropagation();
            return;
        }


        if (isUp && this.isDragged()) {
            Editor.draggedItem = undefined;
            this.onRelease();
            document.body.style.cursor = this.hoveredCursor;

            event.stopImmediatePropagation();
            return;
        }
    }

    public onGrab() { }
    public onGrabbing() { }
    public onRelease() { }
}

export class Click {
    public rect: Rect;

    public hoveredCursor: string = "pointer";
    public holdCursor: string = "pointer";

    public pressed: boolean = false;
    public hovered: boolean = false;

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


    public constructor(rect?: Rect) {
        this.rect = rect ?? new Rect();
    }

    public onRender(r: IRenderer) {
        r.fillColor = "#8f8";
        r.fillRect(this.position, this.size);
    }

    public onEvent(event: SystemEvent): void {
        const isDown = event.type === "mousedown" || event.type === "touchstart";
        const isMove = event.type === "mousemove" || event.type === "touchmove";
        const isUp = event.type === "mouseup" || event.type === "touchend";

        if (isDown && Input.isMouseButtonPressed(0) && this.rect.contains(Input.mousePosition)) {
            this.pressed = true;

            document.body.style.cursor = this.holdCursor;
            this.onMouseDown();
            event.stopImmediatePropagation();
            return;
        }

        if (isMove) {
            const mouseHovered = this.rect.contains(Input.mousePosition);
            if (mouseHovered != this.hovered) {
                if (mouseHovered) {
                    this.onHover();
                }
                else {
                    this.onHoverLeave();
                }
            }
            this.hovered = mouseHovered;

            if (mouseHovered) {
                document.body.style.cursor = this.hoveredCursor;
                event.stopImmediatePropagation();
                return;
            }
        }

        if (isUp && this.pressed && this.rect.contains(Input.mousePosition)) {
            this.pressed = false;

            this.onMouseUp();
            document.body.style.cursor = this.hoveredCursor;
            event.stopImmediatePropagation();
            return;
        }
    }

    public onMouseDown() { }
    public onMouseUp() { }
    public onHover() { }
    public onHoverLeave() { }
}

export class Button extends Click {
    public text: string;
    private color: Color = visualsConfig.colors.toolbarTab as Color;

    public constructor(rect: Rect, text: string) {
        super(rect);
        this.text = text;
    }

    onHoverLeave() {
        this.color = visualsConfig.colors.toolbarTab as Color;
    };
    
    onHover() {
        this.color = visualsConfig.colors.toolbarTabSelected as Color;
    };

    onMouseUp = this.onHover;

    onMouseDown() {
        this.color = visualsConfig.colors.toolbarTabPressed as Color;
        this.onClick();
    };

    public onRender(r: IRenderer) {
        r.fillColor = this.color;
        r.fillRect(this.position, this.size);

        r.fillColor = visualsConfig.colors.textColor as Color;
        r.textBaseLine = "middle";
        r.textAlign = "center";
        r.fontSize = 16;

        r.fillText(this.position.add(this.size.divide(2)), this.text);
    }

    public onClick() {}
}