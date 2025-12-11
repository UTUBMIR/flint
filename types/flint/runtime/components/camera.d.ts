import type { ColorString } from "../../shared/graphics";
import type Vector2D from "../../shared/vector2d";
import RendererComponent from "../renderer-component";
export default class Camera extends RendererComponent {
    enabled: boolean;
    backgroundColor: ColorString;
    get position(): Vector2D;
    get angle(): number;
    attach(): void;
}
