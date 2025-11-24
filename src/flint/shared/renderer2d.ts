import { type IRenderer } from "./irenderer";
import { type Color, type TextAlign, type TextBaseLine } from "./graphics";
import Vector2D from "./vector2d";

export class Renderer2D implements IRenderer {
    public canvas!: HTMLCanvasElement;
    public ctx!: CanvasRenderingContext2D;

    private _fontSize: number = 18;
    private _fontStyle: string = "Arial";

    public setCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) {
        this.canvas = canvas;
        this.ctx = ctx;

        this.updateFont();
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


    set textBaseLine(baseline: TextBaseLine) {
        this.ctx.textBaseline = baseline;
    }

    set textAlign(textAlign: TextAlign) {
        this.ctx.textAlign = textAlign;
    }

    set fontSize(size: number) {
        this._fontSize = size;
        this.updateFont();
    }

    set fontStyle(style: string) {
        this._fontStyle = style;
        this.updateFont();
    }

    translate(position: Vector2D): void {
        this.ctx.translate(position.x, position.y);
    }

    private updateFont() {
        this.ctx.font = this._fontSize.toString() + "px" + " " + this._fontStyle;
    }

    public clearCanvas(): void {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }

    public fillCanvas(): void {
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    public fillRect(position: Vector2D, size: Vector2D): void {
        this.ctx.fillRect(position.x, position.y, size.x, size.y);
    }

    public strokeRect(position: Vector2D, size: Vector2D): void {
        this.ctx.strokeRect(position.x - this.ctx.lineWidth / 2, position.y - this.ctx.lineWidth / 2, size.x + this.ctx.lineWidth, size.y + this.ctx.lineWidth);
    }

    public fillText(position: Vector2D, text: string): void {
        this.ctx.fillText(text, position.x, position.y);
    }

    public strokeText(position: Vector2D, text: string): void {
        this.ctx.strokeText(text, position.x, position.y);
    }

    private makePath(vertices: { x: number, y: number }[]): void {
        this.ctx.beginPath();

        const first = vertices[0];
        if (first) {
            this.ctx.moveTo(first.x, first.y);
        }

        for (let i = 1; i < vertices.length; ++i) {
            const vertex = vertices[i];
            if (vertex) {
                this.ctx.lineTo(vertex.x, vertex.y);
            }
        }

        this.ctx.closePath();
    }

    public fillPolygon(vertices: { x: number, y: number }[]): void {
        this.makePath(vertices);
        this.ctx.fill();
    }

    public strokePolygon(vertices: { x: number, y: number }[]): void {
        this.makePath(vertices);
        this.ctx.stroke();
    }
}