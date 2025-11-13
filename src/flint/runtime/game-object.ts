import type Component from "./component.js";
import Transform from "./transform.js";
import type { IRenderer } from "../shared/irenderer.js";
import Layer from "./layer.js";

export default class GameObject {
    public layer!: Layer;
    private components: Component[] = [];
    public readonly transform;

    public constructor(components?: Component[], transform?: Transform) {
        this.transform = transform ?? new Transform();

        if (components) {
            this.addComponents(components);
        }
    }

    onAttach(): void { }

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
        component.onAttach();
        return component;
    }

    public addComponents<T extends Component>(components: T[]): T[] {
        for (const component of components) {
            this.components.push(component);
            component.parent = this;
        }
        //NOTE: adding and attaching separatly to prevent order errors
        for (const component of components) {
            component.onAttach();
        }
        return components;
    }

    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    public getComponent<T extends Component>(componentType: abstract new (...args: any[]) => T): T | undefined {
        return this.components.find(c => c instanceof componentType) as T | undefined;
    }

    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    public getComponents<T extends Component>(componentType: abstract new (...args: any[]) => T): T[] | undefined {
        return this.components.filter(c => c instanceof componentType) as T[] | undefined;
    }

    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    public hasComponent<T extends Component>(componentType: abstract new (...args: any[]) => T): boolean {
        return this.components.some(c => c instanceof componentType);
    }

    //eslint-disable-next-line @typescript-eslint/no-explicit-any
    public requireComponent<T extends Component>(componentType: abstract new (...args: any[]) => T): T {
        const component = this.getComponent(componentType);
        if (!component) throw new Error(`Required component ${componentType.name ?? "Unknown"} was not found.`);
        return component;
    }

}