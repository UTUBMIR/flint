import type { IVector } from "./ivector";

export default class Vector2 implements IVector {
    public static readonly zero: Vector2 = new Vector2();

    static {
        Vector2.zero.set = function (x: number, y: number) {
            return new Vector2(x, y);
        };
    }

    public x: number;
    public y: number;

    public constructor(x: number = 0, y: number = 0) {
        this.x = x;
        this.y = y;
    }

    public set(x: number, y: number): Vector2 {
        this.x = x;
        this.y = y;
        return this;
    }

    public assign(other: Vector2): Vector2 {
        return this.set(other.x, other.y);
    }

    public copy(): Vector2 {
        return new Vector2(this.x, this.y);
    }

    public add(other: Vector2): Vector2 {
        return this.set(this.x + other.x, this.y + other.y);
    }

    public subtract(other: Vector2): Vector2 {
        return this.set(this.x - other.x, this.y - other.y);
    }

    public multiply(other: Vector2 | number): Vector2 {
        if (other instanceof Vector2) {
            return this.set(this.x * other.x, this.y * other.y);
        }
        else {
            return this.set(this.x * other, this.y * other);
        }
    }

    public divide(other: Vector2 | number): Vector2 {
        if (other instanceof Vector2) {
            return this.set(this.x / other.x, this.y / other.y);
        }
        else {
            return this.set(this.x / other, this.y / other);
        }
    }


    public magnitude(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    public normalize(length: number = 1): Vector2 {
        const mag = this.magnitude();
        if (mag === 0) {
            return this.set(0, 0);
        }
        return this.set((this.x / mag) * length, (this.y / mag) * length);
    }

    public clamp(min: Vector2, max: Vector2): Vector2 {
        return this.set(
            Math.max(min.x, Math.min(max.x, this.x)),
            Math.max(min.y, Math.min(max.y, this.y))
        );
    }

    public equal(other: Vector2): boolean {
        return this.x === other.x && this.y === other.y;
    }

    public round(): Vector2 {
        return this.set(Math.round(this.x), Math.round(this.y));
    }
}