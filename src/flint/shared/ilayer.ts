import type { SystemEventEmitter, SystemEvent } from "../runtime/system-event.js";
import type { Canvas } from "../runtime/system.js";
import type { IRenderer } from "./irenderer.js";

export interface ILayer {
    canvas: Canvas;
    renderer: IRenderer;
    eventEmitter: SystemEventEmitter;
    onAttach(): void

    onUpdate(): void;
    onRender(): void;

    onEvent(event: SystemEvent): void;
};