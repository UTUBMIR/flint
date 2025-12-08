import type InputAxis from "./input-axis";
import Vector2D from "./vector2d";
export default class Input {
    static pressedKeys: Set<string>;
    static pressedMouseButtons: Set<number>;
    static inputAxes: InputAxis[];
    static mousePosition: Vector2D;
    private constructor();
    static get pressedKeyCount(): number;
    static isKeyPressed(keyCode: string): boolean;
    static isMouseButtonPressed(button: number): boolean;
    /**
     * Gets the value of an input axis by its name.
     * @param name of the axis
     * @returns axis value (from -1 to 1)
     */
    static getAxis(name: string): number;
    static init(): void;
    private static onKeyDown;
    private static onKeyUp;
    private static onMouseDown;
    private static onMouseUp;
    private static onMouseMove;
    private static updateInputAxes;
}
