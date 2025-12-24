import type { IVector } from "./ivector";

export default class Vector2 implements IVector {
    public static readonly zero: Vector2 = new Vector2();

    public x: number;
    public y: number = 0;

    public constructor();
    public constructor(z: number);
    public constructor(x: number, y: number);
    public constructor(x: number = 0, y?: number) {
        this.x = x;
        if (y !== undefined) {
            this.y = y;
        }
        else {
            this.y = x;
        }
    }

    public set(x: number, y: number): Vector2 {
        this.x = x;
        this.y = y;
        return this;
    }

    public copy(): Vector2 {
        return new Vector2(this.x, this.y);
    }

    public add(other: Vector2): Vector2 {
        return new Vector2(this.x + other.x, this.y + other.y);
    }

    public subtract(other: Vector2): Vector2 {
        return new Vector2(this.x - other.x, this.y - other.y);
    }

    public multiply(other: Vector2 | number): Vector2 {
        if (other instanceof Vector2) {
            return new Vector2(this.x * other.x, this.y * other.y);
        }
        else {
            return new Vector2(this.x * other, this.y * other);
        }
    }

    public divide(other: Vector2 | number): Vector2 {
        if (other instanceof Vector2) {
            return new Vector2(this.x / other.x, this.y / other.y);
        }
        else {
            return new Vector2(this.x / other, this.y / other);
        }
    }


    public magnitude(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    public normalize(length: number = 1): Vector2 {
        const mag = this.magnitude();
        if (mag === 0) {
            return new Vector2(0, 0);
        }
        return new Vector2((this.x / mag) * length, (this.y / mag) * length);
    }

    public clamp(min: Vector2, max: Vector2): Vector2 {
        return new Vector2(
            Math.max(min.x, Math.min(max.x, this.x)),
            Math.max(min.y, Math.min(max.y, this.y))
        );
    }
}