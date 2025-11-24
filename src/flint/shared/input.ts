import InputAxis from "./input-axis";
import Vector2D from "./vector2d";

export default class Input {
    public static pressedKeys = new Set<string>();
    public static pressedMouseButtons = new Set<number>();

    public static inputAxes: InputAxis[] = []; //TODO: make private
    public static mousePosition: Vector2D = new Vector2D(window.innerWidth / 2, window.innerHeight / 2);

    private constructor() { }

    public static get pressedKeyCount(): number {
        return Input.pressedKeys.size;
    }

    public static isKeyPressed(keyCode: string): boolean {
        return this.pressedKeys.has(keyCode);
    }

    public static isMouseButtonPressed(button: number): boolean {
        return this.pressedMouseButtons.has(button);
    }

    public static getAxis(name: string): number {
        const axis = this.inputAxes.find(a => a.name === name);

        if (!axis) {
            throw new Error(`InputAxis with name ${name} does not exist!`);
        }

        return axis.value;
    }


    public static init() {
        document.addEventListener("keydown", this.onKeyDown.bind(this));
        document.addEventListener("keyup", this.onKeyUp.bind(this));

        document.addEventListener("mousedown", this.onMouseDown.bind(this));
        document.addEventListener("mouseup", this.onMouseUp.bind(this));

        document.addEventListener("touchstart", this.onMouseMove.bind(this));
        document.addEventListener("mousemove", this.onMouseMove.bind(this));
        document.addEventListener("touchmove", this.onMouseMove.bind(this));
    }

    public static onKeyDown(event: KeyboardEvent) {
        this.pressedKeys.add(event.code);
        this.updateInputAxes();
    }

    public static onKeyUp(event: KeyboardEvent) {
        this.pressedKeys.delete(event.code);
        this.updateInputAxes();
    }

    public static onMouseDown(event: MouseEvent) {
        this.pressedMouseButtons.add(event.button);
        this.updateInputAxes();
    }

    public static onMouseUp(event: MouseEvent) {
        this.pressedMouseButtons.delete(event.button);
        this.updateInputAxes();
    }

    public static onMouseMove(event: MouseEvent | TouchEvent) {
        if (event instanceof MouseEvent) {
            this.mousePosition.set(event.pageX, event.pageY);
        }
        else {
            if (event.touches[0]) {
                this.mousePosition.set(event.touches[0].pageX, event.touches[0].pageY);
            }
        }
    }

    private static updateInputAxes() {
        for (const inputAxis of this.inputAxes) {
            inputAxis.update();
        }
    }
}