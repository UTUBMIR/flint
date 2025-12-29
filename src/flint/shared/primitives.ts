import Vector2 from "./vector2";

export class Rect {
    public position: Vector2;
    public size: Vector2;

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
    constructor(position: Vector2, size: Vector2);
    constructor(x: number, y: number, width: number, height: number);
    constructor(
        a?: Vector2 | number,
        b?: Vector2 | number,
        c?: number,
        d?: number
    ) {
        if (a instanceof Vector2 && b instanceof Vector2) {
            this.position = a;
            this.size = b;
        } else {
            const x = typeof a === "number" ? a : 0;
            const y = typeof b === "number" ? b : 0;
            const w = typeof c === "number" ? c : 0;
            const h = typeof d === "number" ? d : 0;
            this.position = new Vector2(x, y);
            this.size = new Vector2(w, h);
        }
    }


    public contains(point: Vector2): boolean {
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
            .copy()
            .add(bounds.size)
            .subtract(this.size);

        this.position.clamp(min, max);
    }



    public copy(): Rect {
        return new Rect(this.position.copy(), this.size.copy());
    }
}