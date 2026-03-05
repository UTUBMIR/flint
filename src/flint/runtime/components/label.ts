import type { IRenderer } from "../../shared/irenderer";
import type { ColorString, TextAlign, TextBaseLine } from "../../shared/graphics";
import { FieldRenderer } from "../../editor/component-builder";
import Vector2 from "../../shared/vector2";
import RendererComponent from "../renderer-component";
import { System } from "../system";
import type { PhysicsWorld } from "../physics-world";

export default class Label extends RendererComponent {
    @FieldRenderer("color")
    public fillColor: ColorString;

    @FieldRenderer("color")
    public lineColor: ColorString;

    @FieldRenderer("color")
    public shadowColor: ColorString;

    public TextBaseLine: TextBaseLine = "hanging";
    public textAlign: TextAlign = "left";

    public text: string = "Label text";

    public fontSize = 18;

    public constructor(fillColor?: ColorString, lineColor?: ColorString, shadowColor?: ColorString) {
        super();
        this.fillColor = fillColor ?? "#cfd2ee";
        this.lineColor = lineColor ?? "#2e2eb6ff";
        this.shadowColor = shadowColor ?? "#1c259bff";
    }

    public override render(renderer: IRenderer): void {
        renderer.fillColor = this.fillColor;
        renderer.lineColor = this.lineColor;
        renderer.lineWidth = 1;
        renderer.lineJoin = "bevel";


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
        renderer.translate(Vector2.zero.subtract(pos));

        renderer.shadowColor = this.shadowColor;
        renderer.shadowBlur = 20;

        renderer.fontSize = this.fontSize;
        renderer.textAlign = this.textAlign;
        renderer.textBaseLine = this.TextBaseLine;

        renderer.fillText(pos.copy().subtract(size.copy().divide(2)), this.text);
        renderer.strokeText(pos.copy().subtract(size.copy().divide(2)), this.text);


        renderer.translate(pos);
        renderer.rotate(-this.transform.rotation);
        renderer.translate(Vector2.zero.subtract(pos));
    }
}
