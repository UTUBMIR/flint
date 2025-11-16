import type { IVector } from "./ivector.js";

export default class Vector2D implements IVector {
    public x: number;
    public y: number;

    public constructor(x: number = 0, y: number = 0) {
        this.x = x;
        this.y = y;
    }

    public set(x: number, y: number): Vector2D {
        this.x = x;
        this.y = y;
        return this;
    }

    public copy(): Vector2D {
        return new Vector2D(this.x, this.y);
    }

    public add(other: Vector2D): Vector2D {
        return new Vector2D(this.x + other.x, this.y + other.y);
    }

    public subtract(other: Vector2D): Vector2D {
        return new Vector2D(this.x - other.x, this.y - other.y);
    }

    public multiply(other: Vector2D | number): Vector2D {
        if (other instanceof Vector2D) {
            return new Vector2D(this.x * other.x, this.y * other.y);
        }
        else {
            return new Vector2D(this.x * other, this.y * other);
        }
    }

    public divide(other: Vector2D | number): Vector2D {
        if (other instanceof Vector2D) {
            return new Vector2D(this.x / other.x, this.y / other.y);
        }
        else {
            return new Vector2D(this.x / other, this.y / other);
        }
    }


    public magnitude(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    public normalize(length: number = 1): Vector2D {
        const mag = this.magnitude();
        if (mag === 0) {
            return new Vector2D(0, 0);
        }
        return new Vector2D((this.x / mag) * length, (this.y / mag) * length);
    }

    public clamp(min: Vector2D, max: Vector2D): Vector2D {
        return new Vector2D(
            Math.max(min.x, Math.min(max.x, this.x)),
            Math.max(min.y, Math.min(max.y, this.y))
        );
    }
}