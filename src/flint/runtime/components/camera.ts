import type Vector2D from "../../shared/vector2d.js";
import Component from "../component.js";

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