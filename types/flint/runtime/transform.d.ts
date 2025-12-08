import Component from "./component";
import Vector2D from "../shared/vector2d";
export default class Transform extends Component {
    position: Vector2D;
    size: Vector2D;
    angle: number;
    constructor(position?: Vector2D, size?: Vector2D, angle?: number);
}
