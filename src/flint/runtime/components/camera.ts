import type Vector2D from "../../shared/vector2d";
import Component from "../component";

export default class Camera extends Component  {
    public enabled: boolean = true;

    public get position(): Vector2D {
        return this.parent.transform.position;
    }


    //TODO: implement camera stuff
    onAttach(): void {
        this.parent.layer.cameras.push(this);
    }
}