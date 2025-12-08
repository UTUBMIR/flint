export type KeyboardBinding = {
    type: "keyboard";
    code: string[];
};
export type MouseBinding = {
    type: "mouse";
    code: number[];
};
export type GamepadBinding = {
    type: "gamepad";
    code: number[];
};
export type KeyBinding = KeyboardBinding | MouseBinding | GamepadBinding;
export type AxisBinding = {
    value: number;
    keys: KeyBinding[];
};
export default class InputAxis {
    readonly name: string;
    bindings: Set<AxisBinding>;
    private _value;
    get value(): number;
    constructor(name: string, bindings?: AxisBinding[]);
    addBinding(binding: AxisBinding): void;
    removeBinding(binding: AxisBinding): void;
    update(): void;
    private isKeyActive;
}
