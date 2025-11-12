import GameObject from "./game-object.js";
import type { IRenderer } from "./irenderer.js";

export default abstract class UGLComponent {
    parent!: GameObject;

    onAttach(): void { }

    onUpdate(): void { }

    //eslint-disable-next-line @typescript-eslint/no-unused-vars
    onRender(renderer: IRenderer): void { }
}