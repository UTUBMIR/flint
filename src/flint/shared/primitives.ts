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


    constructor();
    constructor(position: Vector2D, size: Vector2D);
    constructor(x: number, y: number, width: number, height: number);
    constructor(
        a?: Vector2D | number,
        b?: Vector2D | number,
        c?: number,
        d?: number
    ) {
        if (a instanceof Vector2D && b instanceof Vector2D) {
            this.position = a;
            this.size = b;
        } else {
            const x = typeof a === "number" ? a : 0;
            const y = typeof b === "number" ? b : 0;
            const w = typeof c === "number" ? c : 0;
            const h = typeof d === "number" ? d : 0;
            this.position = new Vector2D(x, y);
            this.size = new Vector2D(w, h);
        }
    }


    public contains(point: Vector2D): boolean {
        return point.x >= this.x &&
            point.x <= this.x + this.width &&
            point.y >= this.y &&
            point.y <= this.y + this.height;
    }

    public intersects(other: Rect) {
        return !(
            other.x > this.x + this.width ||
            other.x + other.width < this.x ||
            other.y > this.y + this.height ||
            other.y + other.height < this.y
        );
    }

    public clamp(bounds: Rect) {
        const min = bounds.position;
        const max = bounds.position
            .add(bounds.size)
            .subtract(this.size);

        this.position = this.position.clamp(min, max);
    }



    public copy(): Rect {
        return new Rect(this.position.copy(), this.size.copy());
    }
}