import type { IRenderer } from "../shared/irenderer";
import Vector2D from "../shared/vector2d";
import { Rect } from "../shared/primitives";
import type { SystemEvent } from "../runtime/system-event";
export default abstract class Window {
    rect: Rect;
    dragOffset: Vector2D;
    static readonly borderWidth = 5;
    protected minSize: Vector2D;
    static readonly titleBarHeight = 20;
    get position(): Vector2D;
    set position(value: Vector2D);
    get size(): Vector2D;
    set size(value: Vector2D);
    readonly title: string;
    constructor(position?: Vector2D, size?: Vector2D, title?: string);
    onAttach(): void;
    onUpdate(): void;
    private onRenderInternal;
    onRender(r: IRenderer): void;
    onRenderContent(r: IRenderer): void;
    onEvent(event: SystemEvent): void;
}
