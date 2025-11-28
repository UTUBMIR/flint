export type RGB = `rgb(${number}, ${number}, ${number})`;
export type RGBA = `rgba(${number}, ${number}, ${number}, ${number})`;
export type HEX = `#${string}`;

export type ColorString = RGB | RGBA | HEX;

const colorRegex = /^(?:rgb\(\s*(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\s*,\s*(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\s*,\s*(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\s*\)|rgba\(\s*(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\s*,\s*(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\s*,\s*(?:[01]?\d{1,2}|2[0-4]\d|25[0-5])\s*,\s*(?:0|0?\.\d+|1(?:\.0)?)\s*\)|#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}))$/;
export function isColorString(value: string): boolean {

    return colorRegex.test(value);
}

export class Color {
    constructor(
        public r: number = 1,
        public g: number = 1,
        public b: number = 1,
        public a: number = 1
    ) {}

    static from255(r: number, g: number, b: number, a: number = 255) {
        return new Color(r / 255, g / 255, b / 255, a / 255);
    }

    static fromHex(hex: string): Color {
        if (hex.startsWith("#")) hex = hex.slice(1);
        if (hex.length === 6) hex += "ff";

        const n = parseInt(hex, 16);

        return new Color(
            ((n >> 24) & 0xff) / 255,
            ((n >> 16) & 0xff) / 255,
            ((n >> 8) & 0xff) / 255,
            (n & 0xff) / 255
        );
    }

    toHex(): string {
        const r = Math.round(this.r * 255);
        const g = Math.round(this.g * 255);
        const b = Math.round(this.b * 255);
        const a = Math.round(this.a * 255);
        return (
            "#" +
            r.toString(16).padStart(2, "0") +
            g.toString(16).padStart(2, "0") +
            b.toString(16).padStart(2, "0") +
            a.toString(16).padStart(2, "0")
        );
    }

    toCSS(): string {
        const r = Math.round(this.r * 255);
        const g = Math.round(this.g * 255);
        const b = Math.round(this.b * 255);
        return `rgba(${r}, ${g}, ${b}, ${this.a})`;
    }
}


export type TextBaseLine = "top" | "hanging" | "alphabetic" | "ideographic" | "bottom" | "middle";
export type TextAlign = "left" | "right" | "center" | "start" | "end";