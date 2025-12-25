import { type ColorString, type TextAlign, type TextBaseLine } from "./graphics";
import type Vector2 from "./vector2";

export type DrawableImage = HTMLCanvasElement | HTMLOrSVGImageElement | HTMLVideoElement | ImageBitmap | OffscreenCanvas | VideoFrame;

export interface IRenderer {
    canvas: HTMLCanvasElement;
    ctx: RenderingContext;

    setCanvas(canvas: HTMLCanvasElement, ctx: RenderingContext): void;

    set fillColor(color: ColorString);

    set lineColor(color: ColorString);
    set lineWidth(width: number);
    set lineJoin(lineJoin: "bevel" | "miter" | "round");

    set shadowColor(color: ColorString);
    set shadowBlur(blur: number);

    set textBaseLine(baseline: TextBaseLine);
    set textAlign(textAlign: TextAlign);

    set fontSize(size: number);

    set fontStyle(style: string);

    resetTransform(): void;

    translate(position: Vector2): void;
    rotate(angle: number): void;

    clearCanvas(): void;
    fillCanvas(): void;

    fillRect(position: Vector2, size: Vector2): void;
    strokeRect(position: Vector2, size: Vector2): void;

    fillText(position: Vector2, text: string): void;
    strokeText(position: Vector2, text: string): void;

    fillPolygon(vertices: {x: number, y: number}[]): void;
    strokePolygon(vertices: {x: number, y: number}[]): void;

    drawImage(image: DrawableImage, dx: number, dy: number): void;
}