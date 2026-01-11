import type { GameSystem } from "./game-system";
import type Layer from "./layer";
import { System, type UUID } from "./system";
import type GameObject from "./game-object";

export class World {
    private layers: Layer[] = [];
    private systems: GameSystem[] = [];
    private running = false;

    public addLayer(layer: Layer, init = true): void {
        if (init) {
            layer.canvas = System.createCanvas();
            layer.renderer = System.renderer;
        }
        System.eventEmitter.addEventListener(layer.onEvent.bind(layer));

        this.layers.push(layer);

        if (init) {
            layer.attach();

            if (this.running) {
                layer.start();
            }
        }
    }

    public removeLayer(layer: Layer, destroy = true) {
        const index = this.layers.indexOf(layer);
        if (index === -1) return;

        this.layers.splice(index, 1);
        // System.eventEmitter.removeEventListener(layer);//BUG: WE MUST REMOVE LISTENER
        if (destroy) {
            layer.destroy();
        }
        else {
            return layer;
        }
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

    public removeSystem(system: GameSystem, destroy = true) {
        const index = this.systems.indexOf(system);
        if (index === -1) return;

        this.systems.splice(index, 1);
        if (destroy) {
            system.destroy();
        }
        else {
            return system;
        }
    }

    public getSystem<T extends GameSystem>(
        ctor: new (...args: unknown[]) => T
    ): T | undefined {
        return this.systems.find(s => s instanceof ctor) as T | undefined;
    }

    private sortSystems(): void {
        this.systems.sort((a, b) => a.order - b.order);
    }


    public getById(id: UUID, prioritizeLayers = true): GameObject | Layer | undefined {
        if (prioritizeLayers) {
            return this.getLayerById(id) ?? this.getGameObjectById(id);
        }
        else {
            return this.getGameObjectById(id) ?? this.getLayerById(id);
        }
    }

    public getLayerById(id: UUID): Layer | undefined {
        const found = this.layers.find(go => go.id === id);
        if (found) {
            return found;
        }
    }

    public getGameObjectById(id: UUID): GameObject | undefined {
        for (let i = 0; i < this.layers.length; ++i) {
            const found = this.layers[i]!.getObjects().find(go => go.id === id);
            if (found) {
                return found;
            }
        }
    }



    public start(send = true): void {
        if (this.running) return;
        this.running = true;

        if (send) {
            for (const l of this.layers) l.start();
        }
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