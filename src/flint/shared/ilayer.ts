import type { Canvas } from "../runtime/system.js";
import type { IRenderer } from "./irenderer.js";

export interface ILayer {
    canvas: Canvas;
    renderer: IRenderer;

    onAttach(): void

    onUpdate(): void;
    onRender(): void;
};