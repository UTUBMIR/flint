import type { IRenderer } from "@flint/shared/irenderer";
import type { ColorString } from "@flint/shared/graphics";
import { FieldInspector } from "@flint/shared/metadata";
import Vector2 from "@flint/shared/vector2";
import RendererComponent from "../renderer-component";
import { System } from "../system";
import type { PhysicsWorld } from "@flint/runtime/physics-world";

export default class Shape extends RendererComponent {
    @FieldInspector("color")
    protected fillColor: ColorString;

    @FieldInspector("color")
    protected lineColor: ColorString;

    @FieldInspector("color")
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
        const line = 4;
        renderer.lineWidth = line;
        renderer.lineJoin = "bevel";

        const world = System.world as Partial<PhysicsWorld>;
        const toPixels = typeof world.toPixels === "function"
            ? world.toPixels.bind(world)
            : (value: number) => value;

        const pos = this.transform.position.copy().set(
            toPixels(this.transform.position.x),
            toPixels(this.transform.position.y)
        );
        // pos.x += line;
        // pos.y += line;

        const size = this.transform.size.copy().set(
            toPixels(this.transform.size.x),
            toPixels(this.transform.size.y)
        );
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
