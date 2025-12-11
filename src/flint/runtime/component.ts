import type GameObject from "./game-object";
import type Transform from "./transform";
import { hideInInspector } from "../editor/component-builder";

export default abstract class Component {
    /**
     * The GameObject that owns this component.
     */
    @hideInInspector()
    public gameObject!: GameObject;

    /**
     * Shortcut to the parent GameObject's Transform component.
     */
    public get transform(): Transform {
        return this.gameObject.transform;
    }

    /**
     * Called once when this component is attached to a GameObject.
     */
    public attach(): void { }

    /**
     * Called once when the game starts or when the component is added during the game.
     * 
     * If added after the game has started, this method will be called immediately after {@link attach}.
     */
    public start(): void { }

    /**
     * Called every frame after {@link start}.
     */
    public update(): void { }

    /**
     * Called when this component is detached from its GameObject.
     * 
     * Use this method to unregister from systems or temporarily stop updates/rendering.
     */
    public detach(): void { }

    /**
     * Called when this component is permanently removed from its GameObject.
     * 
     * Use this method to clean up internal state, unregister from systems, and release any resources.
     * 
     * After {@link destroy} is called, the component
     * should not be reused or reattached.
     */
    public destroy(): void {
        (this.gameObject as GameObject | undefined) = undefined;
    }

    /**
     * Used for hot reload.
     */
    public swapClass<T extends Component>(newType: new () => T): T {
        const newObject = new newType();

        for (const key of Object.keys(this)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (newObject as any)[key] = (this as any)[key];
        }

        return newObject;
    }
}