import { type Color, type TextBaseLine } from "./graphics.js";
import Vector2D from "./vector2d.js";

export interface IRenderer {
    canvas: HTMLCanvasElement;
    ctx: RenderingContext;

    setCanvas(canvas: HTMLCanvasElement, ctx: RenderingContext): void;

    set fillColor(color: Color);

    set lineColor(color: Color);
    set lineWidth(width: number);
    set lineJoin(lineJoin: "bevel" | "miter" | "round");

    set shadowColor(color: Color);
    set shadowBlur(blur: number);

    set textBaseLine(baseline: TextBaseLine);

    set fontSize(size: number);

    set fontStyle(style: string);

    clearCanvas(): void;
    fillCanvas(): void;

    fillRect(position: Vector2D, size: Vector2D): void;
    strokeRect(position: Vector2D, size: Vector2D): void;

    fillText(position: Vector2D, text: string): void;
    strokeText(position: Vector2D, text: string): void;
}