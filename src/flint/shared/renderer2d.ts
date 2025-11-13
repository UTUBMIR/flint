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


    set lineColor(color: Color) {
        this.ctx.strokeStyle = color;
    }

    set lineWidth(width: number) {
        this.ctx.lineWidth = width;
    }

    set lineJoin(lineJoin: "bevel" | "miter" | "round") {
        this.ctx.lineJoin = lineJoin;
    }


    set shadowColor(color: Color) {
        this.ctx.shadowColor = color;
    }
    set shadowBlur(blur: number) {
        this.ctx.shadowBlur = blur;
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

    public strokeRect(position: Vector2D, size: Vector2D): void {
        this.ctx.strokeRect(position.x - this.ctx.lineWidth / 2, position.y - this.ctx.lineWidth / 2, size.x + this.ctx.lineWidth, size.y + this.ctx.lineWidth);
    }
}