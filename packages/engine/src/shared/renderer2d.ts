import { type DrawableImage, type IRenderer } from "./irenderer";
import { type ColorString, type TextAlign, type TextBaseLine } from "./graphics";
import type Vector2 from "./vector2";

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

    public set fillColor(color: ColorString) {
        this.ctx.fillStyle = color;
    }


    public set lineColor(color: ColorString) {
        this.ctx.strokeStyle = color;
    }

    public set lineWidth(width: number) {
        this.ctx.lineWidth = width;
    }

    public set lineJoin(lineJoin: "bevel" | "miter" | "round") {
        this.ctx.lineJoin = lineJoin;
    }


    public set shadowColor(color: ColorString) {
        this.ctx.shadowColor = color;
    }
    public set shadowBlur(blur: number) {
        this.ctx.shadowBlur = blur;
    }


    public set textBaseLine(baseline: TextBaseLine) {
        this.ctx.textBaseline = baseline;
    }

    public set textAlign(textAlign: TextAlign) {
        this.ctx.textAlign = textAlign;
    }

    public set fontSize(size: number) {
        this._fontSize = size;
        this.updateFont();
    }

    public set fontStyle(style: string) {
        this._fontStyle = style;
        this.updateFont();
    }

    public resetTransform(): void {
        this.ctx.resetTransform();
    }

    public translate(position: Vector2): void {
        this.ctx.translate(position.x, position.y);
    }

    public rotate(angle: number): void {
        this.ctx.rotate(angle);
    }

    public scale(x: number, y: number): void {
        this.ctx.scale(x, y);
    }

    private updateFont() {
        this.ctx.font = this._fontSize.toString() + "px" + " " + this._fontStyle;
    }

    public clearCanvas(): void {
        this.ctx.save();

        this.ctx.resetTransform();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.restore();
    }

    public fillCanvas(): void {
        this.ctx.save();

        this.ctx.resetTransform();
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.restore();
    }

    public fillRect(position: Vector2, size: Vector2): void {
        this.ctx.fillRect(position.x, position.y, size.x, size.y);
    }

    public strokeRect(position: Vector2, size: Vector2): void {
        this.ctx.strokeRect(position.x - this.ctx.lineWidth / 2, position.y - this.ctx.lineWidth / 2, size.x + this.ctx.lineWidth, size.y + this.ctx.lineWidth);
    }

    public fillText(position: Vector2, text: string): void {
        this.ctx.fillText(text, position.x, position.y);
    }

    public strokeText(position: Vector2, text: string): void {
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

    public drawImage(image: DrawableImage, dx: number = 0, dy: number = 0, dw?: number, dh?: number) {
        if (dw === undefined || dh === undefined) {
            this.ctx.drawImage(image, dx, dy);
            return;
        }

        this.ctx.drawImage(image, dx, dy, dw, dh);
    }
}
