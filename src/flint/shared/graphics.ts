export type RGB = `rgb(${number}, ${number}, ${number})`;
export type RGBA = `rgba(${number}, ${number}, ${number}, ${number})`;
export type HEX = `#${string}`;

export type Color = RGB | RGBA | HEX;

const colorRegex = /^(?:rgb\(\s*(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\s*,\s*(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\s*,\s*(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\s*\)|rgba\(\s*(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\s*,\s*(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\s*,\s*(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\s*,\s*(?:0|0?\.\d+|1(?:\.0)?)\s*\)|#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}))$/;
export function isColor(value: string): boolean {

    return colorRegex.test(value);
}

export type TextBaseLine = "top" | "hanging" | "alphabetic" | "ideographic" | "bottom" | "middle";
export type TextAlign = "left" | "right" | "center" | "start" | "end";