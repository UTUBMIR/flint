import Component from "./component";
import Vector2D from "../shared/vector2d";
import { customRenderer } from "../editor/component-builder";

export default class Transform extends Component {
    public position: Vector2D;
    public size: Vector2D;
    
    @customRenderer("angle")
    public angle: number;

    public constructor(position?: Vector2D, size?: Vector2D, angle?: number) {
        super();

        this.position = position ?? new Vector2D();
        this.size = size ?? new Vector2D(1, 1);
        this.angle = angle ?? 0;
    }
}