import type { IVector } from "./ivector";
export default class Vector2D implements IVector {
    static readonly zero: Vector2D;
    x: number;
    y: number;
    constructor();
    constructor(x: number);
    constructor(x: number, y: number);
    set(x: number, y: number): Vector2D;
    copy(): Vector2D;
    add(other: Vector2D): Vector2D;
    subtract(other: Vector2D): Vector2D;
    multiply(other: Vector2D | number): Vector2D;
    divide(other: Vector2D | number): Vector2D;
    magnitude(): number;
    normalize(length?: number): Vector2D;
    clamp(min: Vector2D, max: Vector2D): Vector2D;
}
