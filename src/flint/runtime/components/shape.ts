import type { IRenderer } from "../../shared/irenderer";
import type { ColorString } from "../../shared/graphics";
import { FieldRenderer } from "../../editor/component-builder";
import Vector2 from "../../shared/vector2";
import RendererComponent from "../renderer-component";

export default class Shape extends RendererComponent {
    @FieldRenderer("color")
    protected fillColor: ColorString;

    @FieldRenderer("color")
    protected lineColor: ColorString;

    @FieldRenderer("color")
    protected shadowColor: ColorString;

    public constructor(fillColor?: ColorString, lineColor?: ColorString, shadowColor?: ColorString) {
        super();
        this.fillColor = fillColor ?? "#cfd2ee";
        this.lineColor = lineColor ?? "#2e69b6";
        this.shadowColor = shadowColor ?? "#1c649b";
    }

    public override render(renderer: IRenderer): void {
        renderer.fillColor = this.fillColor;
        renderer.lineColor = this.lineColor;
        const line = 4.5;
        renderer.lineWidth = line;
        renderer.lineJoin = "bevel";

        const pos = this.transform.position.copy();
        pos.x += line;
        pos.y += line;

        const size = this.transform.size.copy();
        size.x -= line * 2;
        size.y -= line * 2;

        renderer.translate(pos);
        renderer.rotate(this.transform.rotation);
        renderer.translate(Vector2.zero.subtract(pos));

        renderer.shadowColor = this.shadowColor;
        renderer.shadowBlur = 20;

        renderer.fillRect(pos.copy().subtract(size.copy().divide(2)), size);

        renderer.strokeRect(pos.copy().subtract(size.copy().divide(2)), size);

        renderer.translate(pos);
        renderer.rotate(-this.transform.rotation);
        renderer.translate(Vector2.zero.subtract(pos));
    }
}