import type GameObject from "./game-object";
import { type IRenderer } from "../shared/irenderer";
import { RenderSystem, RunningState, System, type Canvas } from "./system";
import { SystemEventEmitter, SystemEvent } from "./system-event";
import type Camera from "./components/camera";
import Vector2D from "../shared/vector2d";

export default class Layer {
    public canvas!: Canvas;
    public renderer!: IRenderer;
    protected objects: GameObject[] = [];
    public readonly eventEmitter: SystemEventEmitter = new SystemEventEmitter(true, true);
    public readonly cameras: Camera[] = [];

    public readonly renderSystem: RenderSystem = new RenderSystem();

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
     * @param renderer - The renderer used to draw this component.
     */
    public render(): void {
        this.renderObjects();
    }

    public detach(): void { }

    public destroy(): void {
        for (const obj of this.objects) obj.destroy();
    }

    protected updateObjects(): void {
        for (const obj of this.objects) obj.update();
    }

    protected renderObjects(): void {
        if (this.cameras.length === 0) {
            return;
        }
        this.renderer.setCanvas(this.canvas.element, this.canvas.ctx); //FIXME: make it work with more than one camera
        this.renderer.clearCanvas();

        for (const camera of this.cameras) {
            if (camera.enabled) {
                this.renderer.fillColor = camera.backgroundColor;
                this.renderer.fillCanvas();
                this.renderer.resetTransform();

                const canvasHalf = new Vector2D(this.canvas.ctx.canvas.width, this.canvas.ctx.canvas.height).divide(2);

                this.renderer.translate(canvasHalf);
                this.renderer.rotate(camera.angle);
                this.renderer.translate(Vector2D.zero.subtract(camera.position));

                this.renderSystem.render(this.renderer);
            }
        }
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