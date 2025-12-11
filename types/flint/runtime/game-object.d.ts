import type Component from "./component";
import Transform from "./transform";
import type Layer from "./layer";
import { type UUID } from "./system";
export default class GameObject {
    layer: Layer;
    private components;
    readonly transform: Transform;
    readonly uuid: UUID;
    constructor(components?: Component[], transform?: Transform, uuid?: UUID);
    get isAttached(): boolean;
    getAllComponents(): readonly Component[];
    start(): void;
    attach(): void;
    update(): void;
    protected updateComponents(): void;
    detach(): void;
    destroy(): void;
    addComponent<T extends Component>(component: T): T;
    addComponents<T extends Component>(components: T[]): T[];
    getComponent<T extends Component>(componentType: abstract new () => T): T | undefined;
    getComponents<T extends Component>(componentType: abstract new () => T): T[] | undefined;
    hasComponent<T extends Component>(componentType: abstract new () => T): boolean;
    /**
     * Detaches and destroys component of type {@link T}
     */
    removeComponent<T extends Component>(componentType: abstract new () => T): boolean;
    requireComponent<T extends Component>(componentType: abstract new () => T): T;
}
