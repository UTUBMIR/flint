import InputAxis from "./input-axis.js";
import Vector2D from "./vector2d.js";

export default class Input {
    private static pressedKeys = new Set<string>();
    private static pressedMouseButtons = new Set<number>();

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
        document.addEventListener("keydown", this.keyDown.bind(this));
        document.addEventListener("keyup", this.keyUp.bind(this));

        document.addEventListener("mousedown", this.mouseDown.bind(this));
        document.addEventListener("mouseup", this.mouseUp.bind(this));

        document.addEventListener("mousemove", this.mouseMove.bind(this));
        document.addEventListener("touchmove", this.mouseMove.bind(this));
    }

    private static keyDown(event: KeyboardEvent) {
        this.pressedKeys.add(event.code);
        this.updateInputAxes();
    }

    private static keyUp(event: KeyboardEvent) {
        this.pressedKeys.delete(event.code);
        this.updateInputAxes();
    }

    private static mouseDown(event: MouseEvent) {
        this.pressedMouseButtons.delete(event.button);
        this.updateInputAxes();
    }

    private static mouseUp(event: MouseEvent) {
        this.pressedMouseButtons.delete(event.button);
        this.updateInputAxes();
    }

    private static mouseMove(event: MouseEvent | TouchEvent) {
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