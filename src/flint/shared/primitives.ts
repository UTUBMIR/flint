import Vector2D from "./vector2d.js";

export class Rect {
    public position: Vector2D;
    public size: Vector2D;

    public get x() {
        return this.position.x;
    }
    public set x(value: number) {
        this.position.x = value;
    }

    public get y() {
        return this.position.y;
    }
    public set y(value: number) {
        this.position.y = value;
    }

    public get width() {
        return this.size.x;
    }
    public set width(value: number) {
        this.size.x = value;
    }

    public get height() {
        return this.size.y;
    }
    public set height(value: number) {
        this.size.y = value;
    }


    public constructor(position?: Vector2D, size?: Vector2D) {
        this.position = position ?? new Vector2D();
        this.size = size ?? new Vector2D();
    }

    public contains(point: Vector2D): boolean {
        return point.x >= this.x &&
            point.x <= this.x + this.width &&
            point.y >= this.y &&
            point.y <= this.y + this.height;
    }

    public intersects(other: Rect) {
        return !(other.x > this.x + this.width ||
            other.x + other.width < this.x ||
            other.y > this.y + this.height ||
            other.y + other.height + this.y);
    }

    public copy(): Rect {
        return new Rect(this.position.copy(), this.size.copy());
    }
}