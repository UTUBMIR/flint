import type GameObject from "./game-object";
import type Transform from "./transform";
export default abstract class Component {
    /**
     * The GameObject that owns this component.
     */
    gameObject: GameObject;
    /**
     * Shortcut to the parent GameObject's Transform component.
     */
    get transform(): Transform;
    /**
     * Called once when this component is attached to a GameObject.
     */
    attach(): void;
    /**
     * Called once when the game starts or when the component is added during the game.
     *
     * If added after the game has started, this method will be called immediately after {@link attach}.
     */
    start(): void;
    /**
     * Called every frame after {@link start}.
     */
    update(): void;
    /**
     * Called when this component is detached from its GameObject.
     *
     * Use this method to unregister from systems or temporarily stop updates/rendering.
     */
    detach(): void;
    /**
     * Called when this component is permanently removed from its GameObject.
     *
     * Use this method to clean up internal state, unregister from systems, and release any resources.
     *
     * After {@link destroy} is called, the component
     * should not be reused or reattached.
     */
    destroy(): void;
    /**
     * Used for hot reload.
     */
    swapClass<T extends Component>(newType: new () => T): T;
}
