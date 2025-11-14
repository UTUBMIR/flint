import type { SystemEvent } from "../runtime/system-event.js";
import type { IRenderer } from "../shared/irenderer.js";
import type Vector2D from "../shared/vector2d.js";

export interface IWindowObject {
    position: Vector2D;
    size: Vector2D;


    onAttach(): void;

    onUpdate(): void;

    onRender(renderer: IRenderer): void;

    onEvent(event: SystemEvent): void;
}