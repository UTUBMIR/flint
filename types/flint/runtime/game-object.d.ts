import type Component from "./component";
import Transform from "./transform";
import type { IRenderer } from "../shared/irenderer";
import type Layer from "./layer";
import type { UUID } from "./system";
export default class GameObject {
    layer: Layer;
    private components;
    readonly transform: Transform;
    readonly uuid: UUID;
    constructor(components?: Component[], transform?: Transform, uuid?: UUID);
    getAllComponents(): readonly Component[];
    onAttach(): void;
    onUpdate(): void;
    onRender(renderer: IRenderer): void;
    protected updateComponents(): void;
    protected renderComponents(renderer: IRenderer): void;
    addComponent<T extends Component>(component: T): T;
    addComponents<T extends Component>(components: T[]): T[];
    getComponent<T extends Component>(componentType: abstract new (...args: unknown[]) => T): T | undefined;
    getComponents<T extends Component>(componentType: abstract new (...args: unknown[]) => T): T[] | undefined;
    hasComponent<T extends Component>(componentType: abstract new (...args: unknown[]) => T): boolean;
    removeComponent<T extends Component>(componentType: abstract new (...args: unknown[]) => T): boolean;
    requireComponent<T extends Component>(componentType: abstract new (...args: unknown[]) => T): T;
}
