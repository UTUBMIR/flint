import type GameObject from "./game-object";
import { type IRenderer } from "../shared/irenderer";
import { type Canvas } from "./system";
import { SystemEventEmitter, SystemEvent } from "./system-event";
import type Camera from "./components/camera";
export default class Layer {
    canvas: Canvas;
    renderer: IRenderer;
    protected objects: GameObject[];
    readonly eventEmitter: SystemEventEmitter;
    readonly cameras: Camera[];
    /**
     * Called once when this layer is attached.
     */
    onAttach(): void;
    /**
     * Called every frame after {@link onAttach}.
     */
    onUpdate(): void;
    /**
     * Called every frame after {@link onUpdate}.
     * @param renderer - The renderer used to draw this component.
     */
    onRender(): void;
    protected updateObjects(): void;
    protected renderObjects(): void;
    addObject<T extends GameObject>(object: T): T;
    addObjects<T extends GameObject>(objects: T[]): T[];
    removeObject(object: GameObject): void;
    getObjects(): readonly GameObject[];
    onEvent(event: SystemEvent): void;
}
