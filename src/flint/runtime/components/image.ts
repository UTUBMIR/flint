import type { IRenderer } from "../../shared/irenderer";
import Vector2 from "../../shared/vector2";
import RendererComponent from "../renderer-component";
import { AssetHandle } from "../assets";

export default class Image extends RendererComponent {
    private texture = new AssetHandle<ImageBitmap>();

    public override render(renderer: IRenderer): void {
        const image = this.texture.value!;

        renderer.translate(this.transform.position);
        renderer.rotate(this.transform.rotation);

        renderer.drawImage(image, -image.width / 2, -image.height / 2);

        renderer.rotate(-this.transform.rotation);
        renderer.translate(Vector2.zero.subtract(this.transform.position));
    }
}