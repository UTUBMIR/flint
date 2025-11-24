import Component from "./component";
import Vector2D from "../shared/vector2d";

export default class Transform extends Component {
    public position: Vector2D;
    public rotation: Vector2D;

    public constructor(position?: Vector2D, rotation?: Vector2D) {
        super();

        this.position = position ?? new Vector2D();
        this.rotation = rotation ?? new Vector2D();
    }
}