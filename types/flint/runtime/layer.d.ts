import type GameObject from "./game-object";
import { type IRenderer } from "../shared/irenderer";
import { RenderSystem, type Canvas } from "./system";
import { SystemEventEmitter, SystemEvent } from "./system-event";
import type Camera from "./components/camera";
export default class Layer {
    canvas: Canvas;
    renderer: IRenderer;
    protected objects: GameObject[];
    readonly eventEmitter: SystemEventEmitter;
    readonly cameras: Camera[];
    readonly renderSystem: RenderSystem;
    /**
     * Called once when this layer is attached.
     */
    attach(): void;
    /**
     * Called once when the game starts or when the layer is added during the game.
     *
     * If added after the game has started, this method will be called immediately after {@link attach}.
     */
    start(): void;
    /**
     * Called every frame after {@link attach}.
     *
     * Custom logic for subclasses can go here (override)
     */
    update(): void;
    /**
     * Called every frame after {@link update}.
     * @param renderer - The renderer used to draw this component.
     */
    render(): void;
    detach(): void;
    destroy(): void;
    protected updateObjects(): void;
    protected renderObjects(): void;
    addObject<T extends GameObject>(object: T): T;
    addObjects<T extends GameObject>(objects: T[]): T[];
    removeObject(object: GameObject): void;
    getObjects(): readonly GameObject[];
    onEvent(event: SystemEvent): void;
}
