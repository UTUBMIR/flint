import type { IRenderer } from "../shared/irenderer";
import Component from "./component";

export default class RendererComponent extends Component {
    /**
     * Called every frame after {@link update}.
     * @param renderer - The renderer used to draw.
     */
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public render(renderer: IRenderer): void { }

    public attach(): void {
        this.gameObject.layer.renderSystem.register(this);
    }

    public detach(): void {
        this.gameObject.layer.renderSystem.unregister(this);
    }
}