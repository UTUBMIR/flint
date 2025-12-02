import type GameObject from "./game-object";
import { type IRenderer } from "../shared/irenderer";
import { type Canvas } from "./system";
import { SystemEventEmitter, SystemEvent } from "./system-event";
import Camera from "./components/camera";
import Vector2D from "../shared/vector2d";

export default class Layer {
    public canvas!: Canvas;
    public renderer!: IRenderer;
    protected objects: GameObject[] = [];
    public readonly eventEmitter: SystemEventEmitter = new SystemEventEmitter(true, true);
    public readonly cameras: Camera[] = [];

    /**
     * Called once when this layer is attached.
     */
    public onAttach(): void { }

    /**
     * Called every frame after {@link onAttach}.
     */
    onUpdate(): void {
        // custom logic for subclasses can go here (override)
        this.updateObjects();
    }

    /**
     * Called every frame after {@link onUpdate}.
     * @param renderer - The renderer used to draw this component.
     */
    onRender(): void {
        this.renderObjects();
    }

    protected updateObjects(): void {
        for (const obj of this.objects) obj.onUpdate();
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

                for (const obj of this.objects) obj.onRender(this.renderer);
            }
        }
    }

    addObject<T extends GameObject>(object: T): T {
        this.objects.push(object);
        object.layer = this;
        object.onAttach();
        return object;
    }

    addObjects<T extends GameObject>(objects: T[]): T[] {
        for (const object of objects) {
            this.objects.push(object);
            object.layer = this;
            object.onAttach();
        }
        return objects;
    }

    removeObject(object: GameObject): void {
        const index = this.objects.indexOf(object);
        if (index !== -1) this.objects.splice(index, 1);
    }

    getObjects(): readonly GameObject[] {
        return this.objects;
    }

    onEvent(event: SystemEvent): void {
        this.eventEmitter.dispatchEvent(new SystemEvent(event.type));
    }
}