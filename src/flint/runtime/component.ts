import type GameObject from "./game-object";
import type { IRenderer } from "../shared/irenderer";

/* @__SIDE_EFFECTS__ */
export default abstract class Component {
    public parent!: GameObject;

    public onAttach(): void { }

    public onUpdate(): void { }

    //eslint-disable-next-line @typescript-eslint/no-unused-vars
    public onRender(renderer: IRenderer): void { }

    public swapClass<T extends Component>(newType: new () => T): T {
        const newObject = new newType();

        for (const key of Object.keys(this)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (newObject as any)[key] = (this as any)[key];
        }

        return newObject;
    }
}