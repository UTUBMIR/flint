import type Component from "./component";
import Transform from "./transform";
import type { IRenderer } from "../shared/irenderer";
import type Layer from "./layer";
import type { UUID } from "./system";

export default class GameObject {
    public layer!: Layer;
    private components: Component[] = [];
    public readonly transform: Transform;
    public readonly uuid: UUID;

    public constructor(components?: Component[], transform?: Transform, uuid?: UUID) {
        this.transform = transform ?? new Transform();
        this.transform.parent = this;
        this.uuid = uuid ?? crypto.randomUUID() as UUID;

        if (components) {
            this.addComponents(components);
        }
    }

    public getAllComponents(): readonly Component[] {
        return this.components;
    }

    onAttach(): void {
        for (const component of this.components) {
            component.onAttach();
        }
    }

    onUpdate(): void {
        this.updateComponents();
    }
    onRender(renderer: IRenderer): void {
        this.renderComponents(renderer);
    }

    protected updateComponents(): void {
        for (const c of this.components) c.onUpdate();
    }

    protected renderComponents(renderer: IRenderer): void {
        for (const c of this.components) c.onRender(renderer);
    }

    public addComponent<T extends Component>(component: T): T {
        component.parent = this;
        this.components.push(component);

        // if already attached to layer, init manually
        if (this.layer) {
            component.onAttach();
        }
        return component;
    }

    public addComponents<T extends Component>(components: T[]): T[] {
        for (const component of components) {
            this.components.push(component);
            component.parent = this;
        }
        //NOTE: adding and attaching separatly to prevent order errors
        if (this.layer) { // if already attached to layer, init manually
            for (const component of components) {
                component.onAttach();
            }
        }
        return components;
    }

    public getComponent<T extends Component>(componentType: abstract new (...args: unknown[]) => T): T | undefined {
        return this.components.find(c => c instanceof componentType) as T | undefined;
    }

    public getComponents<T extends Component>(componentType: abstract new (...args: unknown[]) => T): T[] | undefined {
        return this.components.filter(c => c instanceof componentType) as T[] | undefined;
    }

    public hasComponent<T extends Component>(componentType: abstract new (...args: unknown[]) => T): boolean {
        return this.components.some(c => c instanceof componentType);
    }

    public removeComponent<T extends Component>(componentType: abstract new (...args: unknown[]) => T): boolean {
        const index = this.components.findIndex(c => c instanceof componentType);
        if (index === -1) {
            return false;
        }

        this.components.splice(index, 1);
        return true;
    }

    public requireComponent<T extends Component>(componentType: abstract new (...args: unknown[]) => T): T {
        const component = this.getComponent(componentType);
        if (!component) throw new Error(`Required component ${componentType.name ?? "Unknown"} was not found.`);
        return component;
    }

}