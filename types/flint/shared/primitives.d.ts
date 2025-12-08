import Vector2D from "./vector2d";
export declare class Rect {
    position: Vector2D;
    size: Vector2D;
    get x(): number;
    set x(value: number);
    get y(): number;
    set y(value: number);
    get width(): number;
    set width(value: number);
    get height(): number;
    set height(value: number);
    constructor();
    constructor(position: Vector2D, size: Vector2D);
    constructor(x: number, y: number, width: number, height: number);
    contains(point: Vector2D): boolean;
    intersects(other: Rect): boolean;
    clamp(bounds: Rect): void;
    copy(): Rect;
}
