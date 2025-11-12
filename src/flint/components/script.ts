import Component from "../component.js";
import GameObject from "../game-object.js";

export default class Script extends Component {
    private code: (gameObject: GameObject) => void;

    public constructor(code: (gameObject: GameObject) => void) {
        super();

        this.code = code;
    }

    public onUpdate(): void {
        this.code(this.parent);
    }
}