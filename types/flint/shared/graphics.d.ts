export type RGB = `rgb(${number}, ${number}, ${number})`;
export type RGBA = `rgba(${number}, ${number}, ${number}, ${number})`;
export type HEX = `#${string}`;
export type ColorString = RGB | RGBA | HEX;
export declare function isColorString(value: string): boolean;
export declare class Color {
    r: number;
    g: number;
    b: number;
    a: number;
    constructor(r?: number, g?: number, b?: number, a?: number);
    static from255(r: number, g: number, b: number, a?: number): Color;
    static fromHex(hex: string): Color;
    toHex(): string;
    toCSS(): string;
}
export type TextBaseLine = "top" | "hanging" | "alphabetic" | "ideographic" | "bottom" | "middle";
export type TextAlign = "left" | "right" | "center" | "start" | "end";
