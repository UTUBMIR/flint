import type GameObject from "./game-object";
import type { IRenderer } from "../shared/irenderer";
import type Transform from "./transform";
import { hideInInspector } from "../editor/component-builder";

export default abstract class Component {
    /**
     * GameObject which owns this component.
     */
    @hideInInspector()
    public parent!: GameObject;

    /**
     * Shortcut to the parent GameObject's transform.
     */
    public get transform(): Transform {
        return this.parent.transform;
    }

    /**
     * Called once when this component is attached to a GameObject.
     */
    public onAttach(): void { }

    /**
     * Called every frame after {@link onAttach}.
     */
    public onUpdate(): void { }

    /**
     * Called every frame after {@link onUpdate}.
     * @param renderer - The renderer used to draw this component.
     */
    public onRender(_renderer: IRenderer): void { }

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