import { type IRenderer } from "./irenderer.js";
import { type Color } from "./graphics.js";
import Vector2D from "./vector2d.js";

export class Renderer2D implements IRenderer {
    public canvas!: HTMLCanvasElement;
    public ctx!: CanvasRenderingContext2D;

    public setCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
        this.canvas = canvas;
        this.ctx = ctx;
    }

    set fillColor(color: Color) {
        this.ctx.fillStyle = color;
    }

    public clearCanvas(): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    public fillCanvas(): void {
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    public rect(position: Vector2D, size: Vector2D): void {
        this.ctx.fillRect(position.x, position.y, size.x, size.y);
    }
}