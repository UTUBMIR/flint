import type { SystemEvent } from "../runtime/system-event.js";
import type { IRenderer } from "../shared/irenderer.js";
import { Rect } from "../shared/primitives.js";
import Vector2D from "../shared/vector2d.js";
import { Drag } from "./interaction.js";
import Window from "./window.js";

export class DockSpace {
    public root: DockNode;

    constructor(bounds: Rect) {
        this.root = new DockNode(bounds);
    }

    public dockWindow(window: Window, target: DockNode, side: "left" | "right" | "top" | "bottom" | "full", ratio: number = 0.5): DockNode {
        let found: DockNode;
        // Якщо target не leaf, знайти перший leaf, який ще не має вікна
        if (!target.isLeaf() || target.window) {
            const f = target.getFirstLeafWithoutWindow();
            if (!f) return target; // немає куди докувати
            found = f;
        }
        else {
            found = target;
        }


        if (side === "full") {
            found.window = window;
            found.childA = undefined;
            found.childB = undefined;
            found.splitDir = undefined;
            found.splitRatio = 1;
            window.rect = found.rect.copy();
        } else {
            const dir = (side === "left" || side === "right") ? "horizontal" : "vertical";

            found.split(dir, ratio);

            if (side === "left" || side === "top") {
                found.childA!.window = window;
                found.childA!.rect = window.rect.copy();
            } else {
                found.childB!.window = window;
                found.childB!.rect = window.rect.copy();
            }
        }

        this.root.updateLayout();
        return found;
    }



    public onRender(r: IRenderer) {
        this.root.onRender(r);
    }

    public onUpdate() {
        this.root.onUpdate();
    }

    public onEvent(event: SystemEvent) {
        this.root.onEvent(event);
    }
}



export class DockNode {
    public rect: Rect;
    public parent?: DockNode;
    public childA: DockNode | undefined;
    public childB: DockNode | undefined;
    public window: Window | undefined;

    public splitter: Drag = new Drag();

    public splitDir?: "horizontal" | "vertical" | undefined;
    public splitRatio: number = 0.5;

    constructor(rect: Rect) {
        this.rect = rect;
        this.splitter.onGrabbing = () => {
            const relative = this.splitter.position.subtract(this.rect.position);
            if (this.splitDir === "horizontal") {
                this.splitRatio = Math.min(Math.max(relative.x / this.rect.width, 0.1), 0.9);
            }
            else {
                this.splitRatio = Math.min(Math.max(relative.y / this.rect.height, 0.1), 0.9);
            }
        };
    }

    public getFirstLeafWithoutWindow(): DockNode | undefined {
        if (this.isLeaf() && !this.window) return this;
        return this.childA?.getFirstLeafWithoutWindow() || this.childB?.getFirstLeafWithoutWindow();
    }


    public isLeaf() {
        return !this.childA && !this.childB;
    }

    public getFirstLeaf(): DockNode {
        if (this.isLeaf()) return this;
        return this.childA!.getFirstLeaf() || this.childB!.getFirstLeaf();
    }

    public split(direction: "horizontal" | "vertical", ratio: number) {
        if (!this.isLeaf()) return;

        this.splitDir = direction;
        this.splitRatio = ratio;

        this.childA = new DockNode(this.rect.copy());
        this.childB = new DockNode(this.rect.copy());

        this.childA.parent = this;
        this.childB.parent = this;

        this.window = undefined;
        this.splitter.draggedCursor = direction === "horizontal" ? "w-resize" : "s-resize";
        this.splitter.hoveredCursor = this.splitter.draggedCursor;
    }

    public updateLayout() {
        const border = 2.5;
        if (this.isLeaf()) {
            if (this.window) {
                // Зменшимо rect для вікна на 5 пікселів рамки
                this.window.rect = new Rect(
                    new Vector2D(this.rect.x + border, this.rect.y + border),
                    new Vector2D(this.rect.width - border * 2, this.rect.height - border * 2)
                );
            }
            return;
        }

        if (!this.childA || !this.childB) return;

        const { x, y, width, height } = this.rect;

        if (this.splitDir === "horizontal") {
            const wA = width * this.splitRatio;
            const wB = width - wA;

            this.childA.rect = new Rect(new Vector2D(x + border, y), new Vector2D(wA, height));
            this.childB.rect = new Rect(new Vector2D(x + border + wA, y), new Vector2D(wB, height));

            if (!this.splitter.isDragged()) {
                this.splitter.rect = new Rect(new Vector2D(x + wA, y), new Vector2D(5, height));
            }
        } else {
            const hA = height * this.splitRatio;
            const hB = height - hA;

            this.childA.rect = new Rect(new Vector2D(x, y + border), new Vector2D(width, hA));
            this.childB.rect = new Rect(new Vector2D(x, y + border + hA), new Vector2D(width, hB));

            if (!this.splitter.isDragged()) {
                this.splitter.rect = new Rect(new Vector2D(x, y + hA), new Vector2D(width, 5));
            }
        }

        this.childA.updateLayout();
        this.childB.updateLayout();
    }

    public onRender(r: IRenderer) {
        if (this.isLeaf()) {
            if (this.window) {
                this.window.onRender(r);
            }
        } else {
            this.childA?.onRender(r);
            this.childB?.onRender(r);
            //this.splitter.onRender(r);
        }
    }

    public onUpdate() {
        if (this.isLeaf()) {
            if (this.window) {
                this.window.onUpdate();
            }
        } else {
            this.childA?.onUpdate();
            this.childB?.onUpdate();
        }
    }

    public onEvent(event: SystemEvent) {
        if (this.isLeaf()) {
            if (this.window) {
                this.window.onEvent(event);
            }
        } else {
            this.splitter.onEvent(event);
            this.childA?.onEvent(event);
            this.childB?.onEvent(event);
        }
    }
}