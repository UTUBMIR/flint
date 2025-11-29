import type GameObject from "./game-object";
import type { IRenderer } from "../shared/irenderer";
import type Transform from "./transform";
import { hideFromInspector } from "../editor/component-builder";

export default abstract class Component {
    @hideFromInspector()
    public parent!: GameObject;

    public get transform(): Transform {
        return this.parent.transform;
    }

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