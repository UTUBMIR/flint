import type { IRenderer } from "../../shared/irenderer";
import Vector2 from "../../shared/vector2";
import RendererComponent from "../renderer-component";
import { AssetHandle } from "../assets";
import type { UUID } from "../system";

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

        renderer.translate(this.transform.position);
        renderer.rotate(this.transform.rotation);

        renderer.drawImage(image, Math.round(-image.width / 2), Math.round(-image.height / 2));

        renderer.rotate(-this.transform.rotation);
        renderer.translate(Vector2.zero.subtract(this.transform.position));
    }
}