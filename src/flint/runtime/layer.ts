import type GameObject from "./game-object";
import { type IRenderer } from "../shared/irenderer";
import { RenderSystem, RunningState, System, type UUID } from "./system";
import { SystemEventEmitter, SystemEvent } from "./system-event";

export default class Layer {
    protected objects: GameObject[] = [];
    public readonly eventEmitter: SystemEventEmitter = new SystemEventEmitter(true, true);

    public readonly id: UUID;

    public readonly renderSystem: RenderSystem = new RenderSystem();

    public constructor(uuid?: UUID) {
        this.id = uuid ?? crypto.randomUUID();
    }

    /**
     * Called once when this layer is attached.
     */
    public attach(): void { }

    /**
     * Called once when the game starts or when the layer is added during the game.
     * 
     * If added after the game has started, this method will be called immediately after {@link attach}.
     */
    public start(): void {
        for (const object of this.objects) {
            object.start();
        }
    }

    /**
     * Called every frame after {@link attach}.
     * 
     * Custom logic for subclasses can go here (override)
     */
    public update(): void {
        this.updateObjects();
    }

    /**
     * Called every frame after {@link update}.
     * @param ctx - The canvas rendering context to draw on.
     * @param renderer - The renderer used to draw this component.
     */
    public render(ctx: CanvasRenderingContext2D, renderer: IRenderer): void {
        this.renderObjects(ctx, renderer);
    }

    public detach(): void { }

    public destroy(): void {
        for (const obj of this.objects) obj.destroy();
    }

    protected updateObjects(): void {
        for (const obj of this.objects) obj.update();
    }

    protected renderObjects(ctx: CanvasRenderingContext2D, renderer: IRenderer): void {
        this.renderSystem.render(renderer);
    }

    public addObject<T extends GameObject>(object: T): T {
        this.objects.push(object);
        object.layer = this;
        object.attach();

        if (System.runningState === RunningState.Running) {
            object.start();
        }

        return object;
    }

    public addObjects<T extends GameObject>(objects: T[]): T[] {
        for (const object of objects) {
            this.objects.push(object);
            object.layer = this;
        }

        //NOTE: adding and attaching separatly to prevent dependency errors
        for (const object of objects) {
            object.attach();
        }

        if (System.runningState === RunningState.Running) {
            for (const object of objects) {
                object.start();
            }
        }

        return objects;
    }

    public removeObject(object: GameObject): void {
        const index = this.objects.indexOf(object);
        if (index !== -1) {
            this.objects[index]!.destroy();
            this.objects.splice(index, 1);
        }
    }

    public getObjects(): readonly GameObject[] {
        return this.objects;
    }

    public onEvent(event: SystemEvent): void {
        this.eventEmitter.dispatchEvent(new SystemEvent(event.type));
    }
}
