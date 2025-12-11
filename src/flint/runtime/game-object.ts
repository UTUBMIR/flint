import type Component from "./component";
import Transform from "./transform";
import type Layer from "./layer";
import { RunningState, System, type UUID } from "./system";

export default class GameObject {
    public layer!: Layer;
    private components: Component[] = [];
    public readonly transform: Transform;
    public readonly uuid: UUID;

    public constructor(components?: Component[], transform?: Transform, uuid?: UUID) {
        this.transform = transform ?? new Transform();
        this.transform.gameObject = this;
        this.uuid = uuid ?? crypto.randomUUID() as UUID;

        if (components) {
            this.addComponents(components);
        }
    }

    public get isAttached(): boolean {
        return !!this.layer;
    }

    public getAllComponents(): readonly Component[] {
        return this.components;
    }

    public start(): void {
        for (const c of this.components) c.start(); // Assume that we are already attached
    }

    public attach(): void {
        for (const c of this.components) c.attach();
    }

    public update(): void {
        this.updateComponents();
    }

    protected updateComponents(): void {
        for (const c of this.components) {c.update(); c.gameObject = this;};
    }

    public detach(): void {
        for (const c of this.components) c.detach();
    }

    public destroy(): void {
        if (this.isAttached) {
            this.detach();
        }
        for (const c of this.components) c.destroy();

        this.transform.detach();
        this.transform.destroy();

        this.components.length = 0;
    }

    public addComponent<T extends Component>(component: T): T {
        component.gameObject = this;
        this.components.push(component);

        if (this.isAttached) {
            component.attach();
            if (System.runningState === RunningState.Running) {
                component.start();
            }
        }

        return component;
    }

    public addComponents<T extends Component>(components: T[]): T[] {
        for (const component of components) {
            component.gameObject = this;
            this.components.push(component);
        }
        //NOTE: adding and attaching separatly to prevent dependency errors
        if (this.isAttached) {
            for (const component of components) {
                component.attach();
            }

            if (System.runningState === RunningState.Running) {
                for (const component of components) {
                    component.start();
                }
            }
        }

        return components;
    }

    public getComponent<T extends Component>(componentType: abstract new () => T): T | undefined {
        return this.components.find(c => c instanceof componentType) as T | undefined;
    }

    public getComponents<T extends Component>(componentType: abstract new () => T): T[] | undefined {
        return this.components.filter(c => c instanceof componentType) as T[] | undefined;
    }

    public hasComponent<T extends Component>(componentType: abstract new () => T): boolean {
        return this.components.some(c => c instanceof componentType);
    }

    /**
     * Detaches and destroys component of type {@link T}
     */
    public removeComponent<T extends Component>(componentType: abstract new () => T): boolean {
        const index = this.components.findIndex(c => c instanceof componentType);
        if (index === -1) {
            return false;
        }
        
        if (this.isAttached) {
            this.components[index]!.detach();
        }

        this.components[index]!.destroy();
        this.components = this.components.splice(index, 1);
        return true;
    }

    public requireComponent<T extends Component>(componentType: abstract new () => T): T {
        const component = this.getComponent(componentType);
        if (!component) throw new Error(`Required component ${componentType.name ?? "Unknown"} was not found.`);
        return component;
    }
}