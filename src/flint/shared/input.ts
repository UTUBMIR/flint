import { System } from "../runtime/system";
import { World } from "../runtime/world";
import type InputAxis from "./input-axis";
import Vector2 from "./vector2";

export default class Input {
    public static pressedKeys = new Set<string>();
    public static pressedMouseButtons = new Set<number>();

    public static inputAxes: InputAxis[] = []; //TODO: make private

    // `mousePositionPixels` is the raw pointer position in renderer coordinates (device pixels).
    // `mousePosition` is the same position in world units (meters), derived using `pixelsPerMeter`.
    public static mousePositionPixels: Vector2 = new Vector2(window.innerWidth / 2, window.innerHeight / 2);
    public static mousePosition: Vector2 = new Vector2(window.innerWidth / 2, window.innerHeight / 2);

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

    /**
     * Gets the value of an input axis by its name.
     * @param name of the axis
     * @returns axis value (from -1 to 1)
     */
    public static getAxis(name: string): number {
        const axis = this.inputAxes.find(a => a.name === name);

        if (!axis) {
            throw new Error(`InputAxis with name ${name} does not exist!`);
        }

        return axis.value;
    }


    public static init(root: HTMLElement) {
        root = document.body;
        root.addEventListener("keydown", this.onKeyDown.bind(this), true);
        root.addEventListener("keyup", this.onKeyUp.bind(this), true);

        root.addEventListener("pointerdown", this.onPointerDown.bind(this), true);
        root.addEventListener("pointerup", this.onPointerUp.bind(this), true);

        root.addEventListener("pointermove", this.onPointerMove.bind(this), { passive: true, capture: true });
    }

    private static pixelsPerMeter(): number {
        const world = System.world as Partial<{ pixelsPerMeter: number }>;
        return typeof world.pixelsPerMeter === "number" && world.pixelsPerMeter > 0 ? world.pixelsPerMeter : 1;
    }

    private static setMouseFromEvent(event: PointerEvent): void {
        const canvasHalf = System.rootSize.divide(2).round();

        this.mousePositionPixels.set(event.offsetX, event.offsetY)
            .subtract(canvasHalf)
            .multiply(System.dpr);

        const ppm = this.pixelsPerMeter();
        this.mousePosition.set(
            World.toPhysicsUnits(this.mousePositionPixels.x, ppm),
            World.toPhysicsUnits(this.mousePositionPixels.y, ppm)
        );
    }

    private static onKeyDown(event: KeyboardEvent) {
        this.pressedKeys.add(event.code);
        this.updateInputAxes();
    }

    private static onKeyUp(event: KeyboardEvent) {
        this.pressedKeys.delete(event.code);
        this.updateInputAxes();
    }

    private static onPointerDown(event: PointerEvent) {
        this.pressedMouseButtons.add(event.button);
        this.setMouseFromEvent(event);

        this.updateInputAxes();
    }

    private static onPointerUp(event: PointerEvent) {
        this.pressedMouseButtons.delete(event.button);
        this.setMouseFromEvent(event);

        this.updateInputAxes();
    }

    private static onPointerMove(event: PointerEvent) {
        this.setMouseFromEvent(event);
    }

    private static updateInputAxes() {
        for (const inputAxis of this.inputAxes) {
            inputAxis.update();
        }
    }
}
