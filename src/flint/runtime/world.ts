import type { GameSystem } from "./game-system";
import type Layer from "./layer";
import { System, type UUID } from "./system";
import type GameObject from "./game-object";


export class World {
    protected layers: Layer[] = [];
    protected systems: GameSystem[] = [];
    protected running = false;

    /**
     * Registers and initializes layer
     * @param layer layer to register
     * @param init if `true` -> initialize layer
     */
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


    /**
     * Unregisters and destroys layer
     * @param layer layer to remove
     * @param destroy if `true` -> destroy layer
     */
    public removeLayer(layer: Layer, destroy = true) {
        const index = this.layers.indexOf(layer);
        if (index === -1) return;

        this.layers.splice(index, 1);
        // System.eventEmitter.removeEventListener(layer);//BUG: WE MUST REMOVE LISTENER
        if (destroy) {
            layer.destroy();
        }
    }

    /**
     * Push layer to registry without any initialization.
     * 
     * **Use this method only when you know what you do, if not -> use {@link addLayer}**
     * @param layer 
     */
    public pushLayer(layer: Layer) {
        this.layers.push(layer);
    }

    /**
     * Unshift layer to registry without any initialization.
     * 
     * **Use this method only when you know what you do, if not -> use {@link addLayer}**
     * @param layer 
     */
    public unshiftLayer(layer: Layer) {
        this.layers.unshift(layer);
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

    /**
     * @deprecated
     */
    public sortLayers() {
        for (let i = 0; i < this.layers.length; ++i) {
            const layer = this.layers[i]!;
            layer.canvas.element.style.zIndex = (-i+100).toString();
        }
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

        this.updateStep();
    }

    public updateStep(): void { }

    public render(): void {
        for (const s of this.systems) {
            if (s.enabled) s.render();
        }

        for (const l of this.layers) {
            l.render();
        }
        this.renderStep();
    }

    public renderStep(): void { }

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