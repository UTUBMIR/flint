import Component from "./component";
import Vector2D from "../shared/vector2d";

export default class Transform extends Component {
    public position: Vector2D;
    public angle: number;

    public constructor(position?: Vector2D, angle?: number) {
        super();

        this.position = position ?? new Vector2D();
        this.angle = angle ?? 0;
    }
}