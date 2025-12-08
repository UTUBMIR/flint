import type { SystemEvent } from "../runtime/system-event";
import type { IRenderer } from "../shared/irenderer";
import { Rect } from "../shared/primitives";
import Vector2D from "../shared/vector2d";
import type { ColorString } from "../shared/graphics";
export declare class Drag {
    rect: Rect;
    dragOffset: Vector2D;
    hoveredCursor: string;
    draggedCursor: string;
    get position(): Vector2D;
    set position(value: Vector2D);
    get size(): Vector2D;
    set size(value: Vector2D);
    isDragged(): boolean;
    constructor(rect?: Rect);
    onRender(r: IRenderer): void;
    onEvent(event: SystemEvent): void;
    onGrab(): void;
    onGrabbing(): void;
    onRelease(): void;
}
export declare class Click {
    rect: Rect;
    hoveredCursor: string;
    holdCursor: string;
    pressed: boolean;
    hovered: boolean;
    get position(): Vector2D;
    set position(value: Vector2D);
    get size(): Vector2D;
    set size(value: Vector2D);
    constructor(rect?: Rect);
    onRender(r: IRenderer): void;
    onEvent(event: SystemEvent): void;
    onMouseDown(): void;
    onMouseUp(): void;
    onHover(): void;
    onHoverLeave(): void;
}
export declare class Button extends Click {
    text: string;
    color: ColorString;
    constructor(rect: Rect, text?: string);
    onHoverLeave(): void;
    onHover(): void;
    onMouseUp: () => void;
    onMouseDown(): void;
    onRender(r: IRenderer): void;
    onClick(): void;
}
export declare class Tree {
    readonly button: Button;
    items: (Click | Drag | Tree | {
        rect: Rect;
        onRender: (r: IRenderer) => void;
        onEvent: (e: SystemEvent) => void;
    })[];
    private _contentHeight;
    open: boolean;
    triangleRadius: number;
    nestedSpacing: number;
    private locked;
    get rect(): Rect;
    set rect(rect: Rect);
    get contentHeight(): number;
    constructor(rect: Rect, name?: string);
    lockState(open: boolean): void;
    onRender(r: IRenderer): void;
    onRenderInternal(r: IRenderer): void;
    onRenderContent(r: IRenderer): void;
    onEvent(event: SystemEvent): void;
}
