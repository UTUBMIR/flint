import { type Color } from "./graphics.js";
import Vector2D from "./vector2d.js";

export interface IRenderer {
    canvas: HTMLCanvasElement;
    ctx: RenderingContext;

    setCanvas(canvas: HTMLCanvasElement, ctx: RenderingContext): void;

    set fillColor(color: Color);

    clearCanvas(): void;
    fillCanvas(): void;

    rect(position: Vector2D, size: Vector2D): void;
}