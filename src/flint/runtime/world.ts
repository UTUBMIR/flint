import type { GameSystem } from "./game-system";
import type Layer from "./layer";

export class World {
    private layers: Layer[] = [];
    private systems: GameSystem[] = [];
    private running = false;

    public addLayer(layer: Layer): void {
        if (this.layers.includes(layer)) return;

        this.layers.push(layer);
        layer.attach();

        if (this.running) layer.start();
    }

    public removeLayer(layer: Layer): void {
        const index = this.layers.indexOf(layer);
        if (index === -1) return;

        this.layers.splice(index, 1);
        layer.destroy();
    }

    public getLayers(): readonly Layer[] {
        return this.layers;
    }




    public addSystem(system: GameSystem): void {
        if (this.systems.includes(system)) return;

        system.init(this);
        this.systems.push(system);
        this.sortSystems();
    }

    public removeSystem(system: GameSystem): void {
        const index = this.systems.indexOf(system);
        if (index === -1) return;

        this.systems.splice(index, 1);
        system.destroy();
    }

    public getSystem<T extends GameSystem>(
        ctor: new (...args: unknown[]) => T
    ): T | undefined {
        return this.systems.find(s => s instanceof ctor) as T | undefined;
    }

    private sortSystems(): void {
        this.systems.sort((a, b) => a.order - b.order);
    }





    public start(): void {
        if (this.running) return;
        this.running = true;

        for (const l of this.layers) l.start();
    }

    public update(): void {
        if (!this.running) return;

        for (const s of this.systems) {
            if (s.enabled) s.update();
        }

        for (const l of this.layers) {
            l.update();
        }
    }

    public render(): void {
        if (!this.running) return;

        for (const s of this.systems) {
            if (s.enabled) s.render();
        }

        for (const l of this.layers) {
            l.render();
        }
    }

    public stop(): void {
        if (!this.running) return;
        this.running = false;
    }

    public destroy(): void {
        this.stop();

        for (const s of this.systems) s.destroy();
        for (const l of this.layers) l.destroy();

        this.systems.length = 0;
        this.layers.length = 0;
    }
}