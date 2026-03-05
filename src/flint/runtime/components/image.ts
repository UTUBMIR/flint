import type { IRenderer } from "../../shared/irenderer";
import Vector2 from "../../shared/vector2";
import RendererComponent from "../renderer-component";
import { AssetHandle } from "../assets";
import { System, type UUID } from "../system";
import type { PhysicsWorld } from "../physics-world";

export default class Image extends RendererComponent {
    private texture = new AssetHandle<ImageBitmap>("" as UUID);

    public override start(): void {
        this.texture?.request();
    }

    public override render(renderer: IRenderer): void {
        const image = this.texture.value;
        if (!image) {
            if (this.texture.id) {
                this.texture.request();
            }

            return;
        }

        renderer.shadowColor = "#fff0";

        const world = System.world as Partial<PhysicsWorld>;
        const toPixels = typeof world.toPixels === "function"
            ? world.toPixels.bind(world)
            : (value: number) => value;
        const pos = this.transform.position.copy().set(
            toPixels(this.transform.position.x),
            toPixels(this.transform.position.y)
        );
        const size = this.transform.size.copy().set(
            toPixels(this.transform.size.x),
            toPixels(this.transform.size.y)
        );

        renderer.translate(pos);
        renderer.rotate(this.transform.rotation);

        renderer.drawImage(
            image,
            Math.round(-size.x / 2),
            Math.round(-size.y / 2),
            Math.round(size.x),
            Math.round(size.y)
        );

        renderer.rotate(-this.transform.rotation);
        renderer.translate(Vector2.zero.subtract(pos));
    }
}
