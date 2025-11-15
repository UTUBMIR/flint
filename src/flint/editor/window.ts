import type { SystemEvent } from "../runtime/system-event.js";
import Input from "../shared/input.js";
import type { IRenderer } from "../shared/irenderer.js";
import Vector2D from "../shared/vector2d.js";
import Editor from "./editor.js";
import visualsConfig from "./config/visuals.json" with { type: 'json' };
import type { Color } from "../shared/graphics.js";
import type DockContainer from "./dock-container.js";


export default abstract class Window {
    public position: Vector2D;
    public size: Vector2D;
    public dragOffset: Vector2D = new Vector2D();
    public static readonly borderWidth = 5;
    protected minSize = new Vector2D(100, 100);
    public static readonly titleBarHeight = 20;
    private resize = 0;
    private resizeSide = 0;

    public dockContainer: DockContainer | undefined;
    public titlePosition: Vector2D = new Vector2D();

    public readonly title: string;

    public constructor(position?: Vector2D, size?: Vector2D, title: string = "new window") {
        this.position = position ?? new Vector2D();
        this.size = size ?? new Vector2D(100, 100);
        this.title = title;

        this.constrainPosition();
    }

    public onAttach(): void { };

    public onUpdate(): void { };

    public onRender(r: IRenderer) {
        if (!this.dockContainer || this.dockContainer.getActiveWindow() === this) {
            r.fillColor = visualsConfig.colors.windowColor as Color;
            r.lineColor = visualsConfig.colors.windowEdgeColor as Color;
            r.lineWidth = Window.borderWidth;
            r.lineJoin = "bevel";

            r.shadowColor = visualsConfig.colors.windowShadowColor as Color;
            r.shadowBlur = 20;

            r.strokeRect(this.position, this.size);
            r.fillRect(this.position, this.size);

            r.fillColor = visualsConfig.colors.titleColor as Color;
            r.fillRect(this.position, new Vector2D(this.size.x, Window.titleBarHeight));


            this.onContentRender(r);
        }

        if (this.onTitleBar()) {
            r.fillColor = visualsConfig.colors.titleBarActiveItemColor as Color;
        }
        else if (this.dockContainer && this.dockContainer.getActiveWindow() === this) {
            r.fillColor = visualsConfig.colors.titleBarSelectedItemColor as Color;
        }
        else {
            r.fillColor = visualsConfig.colors.titleBarItemColor as Color;
        }

        r.fillRect(this.position.add(this.titlePosition), new Vector2D(120, Window.titleBarHeight));

        r.fillColor = visualsConfig.colors.textColor as Color;
        r.textBaseLine = "middle";
        r.textAlign = "left";
        r.fontSize = 16;
        r.fillText(this.position.add(new Vector2D(this.titlePosition.x + 5, Window.titleBarHeight / 2)), this.title);
    }

    public onTitleBar(): boolean {
        return Input.mousePosition.x >= this.position.x + this.titlePosition.x && Input.mousePosition.y >= this.position.y + this.titlePosition.y &&
            Input.mousePosition.x <= this.position.x + this.titlePosition.x + 120 && Input.mousePosition.y <= this.position.y + this.titlePosition.y + Window.titleBarHeight;
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public onContentRender(r: IRenderer): void { };

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

        if (isUp) {
            if (this.dockContainer && this.onTitleBar()) {
                Editor.resizedWindow = undefined;
                Editor.draggedWindow = undefined;
                this.dockContainer.setActiveWindow(this);
                return;
            }
        }

        if (isUp && (Editor.draggedWindow === this || Editor.resizedWindow === this)) {
            Editor.resizedWindow = undefined;
            Editor.draggedWindow = undefined;

            const target = Editor.tryDock(this);
            if (target) {
                Editor.createDockContainer(target, this);
                return;
            }
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

        const topOrLeft = this.resizeSide === 0;

        switch (this.resize) {
            // LEFT / RIGHT
            case 1:
                if (topOrLeft) {
                    this.position.x = mx;
                    this.size.x = right - mx;
                } else {
                    this.size.x = mx - x;
                }
                break;

            // TOP / BOTTOM
            case 2:
                if (topOrLeft) {
                    this.position.y = my;
                    this.size.y = bottom - my;
                } else {
                    this.size.y = my - y;
                }
                break;

            // TOP-LEFT / BOTTOM-RIGHT
            case 3:
                if (topOrLeft) {
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
                if (topOrLeft) { // TOP-RIGHT
                    this.position.y = my;
                    this.size.y = bottom - my;

                    // FIX: width change only to the right
                    const newWidth = mx - x;
                    if (newWidth >= this.minSize.x) {
                        this.size.x = newWidth;
                    } else {
                        this.size.x = this.minSize.x;
                    }
                } else { // BOTTOM-LEFT
                    this.position.x = mx;
                    this.size.x = right - mx;
                    this.size.y = my - y;
                }
                break;

        }
        if (this.size.x < this.minSize.x) {
            if (topOrLeft || this.resize === 4) {
                this.position.x = mx - (this.minSize.x - this.size.x);
            }
            this.size.x = this.minSize.x;
        }
        if (this.size.y < this.minSize.y) {
            if (topOrLeft) {
                this.position.y = my - (this.minSize.y - this.size.y);
            }
            this.size.y = this.minSize.y;
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