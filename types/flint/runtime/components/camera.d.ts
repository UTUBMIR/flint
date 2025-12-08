import type { ColorString } from "../../shared/graphics";
import type Vector2D from "../../shared/vector2d";
import Component from "../component";
export default class Camera extends Component {
    enabled: boolean;
    backgroundColor: ColorString;
    get position(): Vector2D;
    get angle(): number;
    onAttach(): void;
}
