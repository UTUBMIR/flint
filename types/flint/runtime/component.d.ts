import type GameObject from "./game-object";
import type { IRenderer } from "../shared/irenderer";
import type Transform from "./transform";
export default abstract class Component {
    /**
     * GameObject which owns this component.
     */
    parent: GameObject;
    /**
     * Shortcut to the parent GameObject's transform.
     */
    get transform(): Transform;
    /**
     * Called once when this component is attached to a GameObject.
     */
    onAttach(): void;
    /**
     * Called every frame after {@link onAttach}.
     */
    onUpdate(): void;
    /**
     * Called every frame after {@link onUpdate}.
     * @param renderer - The renderer used to draw this component.
     */
    onRender(_renderer: IRenderer): void;
    /**
     * Used for hot reload.
     */
    swapClass<T extends Component>(newType: new () => T): T;
}
