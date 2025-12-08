import { type IRenderer } from "./irenderer";
import { type ColorString, type TextAlign, type TextBaseLine } from "./graphics";
import type Vector2D from "./vector2d";
export declare class Renderer2D implements IRenderer {
    canvas: HTMLCanvasElement;
    ctx: CanvasRenderingContext2D;
    private _fontSize;
    private _fontStyle;
    setCanvas(canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D): void;
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
    translate(position: Vector2D): void;
    rotate(angle: number): void;
    private updateFont;
    clearCanvas(): void;
    fillCanvas(): void;
    fillRect(position: Vector2D, size: Vector2D): void;
    strokeRect(position: Vector2D, size: Vector2D): void;
    fillText(position: Vector2D, text: string): void;
    strokeText(position: Vector2D, text: string): void;
    private makePath;
    fillPolygon(vertices: {
        x: number;
        y: number;
    }[]): void;
    strokePolygon(vertices: {
        x: number;
        y: number;
    }[]): void;
}
