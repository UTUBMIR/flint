import type GameObject from "./game-object.js";
import { type IRenderer } from "../shared/irenderer.js";
import { type Canvas } from "./system.js";
import { type ILayer } from "../shared/ilayer.js";

export default class Layer implements ILayer {
    public canvas!: Canvas;
    public renderer!: IRenderer;
    protected objects: GameObject[] = [];

    public onAttach(): void { }

    /** Called every frame */
    onUpdate(): void {
        // custom logic for subclasses can go here (override)
        this.updateObjects();
    }

    /** Called every frame after onUpdate */
    onRender(): void {
        this.renderObjects();
    }

    protected updateObjects(): void {
        for (const obj of this.objects) obj.onUpdate();
    }

    protected renderObjects(): void {
        this.renderer.setCanvas(this.canvas.element, this.canvas.ctx);
        this.renderer.clearCanvas();
        for (const obj of this.objects) obj.onRender(this.renderer);
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
}