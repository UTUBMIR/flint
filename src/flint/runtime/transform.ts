import Component from "./component";
import Vector2 from "../shared/vector2";
import { FieldInspector } from "@flint/shared/metadata";

export default class Transform extends Component {
    public position: Vector2;
    public size: Vector2;
    
    @FieldInspector("angle")
    public rotation: number;

    public constructor(position?: Vector2, size?: Vector2, angle?: number) {
        super();

        this.position = position ?? new Vector2();
        this.size = size ?? new Vector2(1, 1);
        this.rotation = angle ?? 0;
    }
}