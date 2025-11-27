import Input from "./input";

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
export type AxisBinding = { value: number; keys: KeyBinding[] };//TODO: Add gamepad support

export default class InputAxis {
    public readonly name: string;
    public bindings: Set<AxisBinding>;

    private _value: number = 0;

    public get value(): number {
        return this._value;
    }

    constructor(name: string, bindings?: AxisBinding[]) {
        this.name = name;

        if (bindings) {
            this.bindings = new Set<AxisBinding>(bindings);
        }
        else {
            this.bindings = new Set<AxisBinding>();
        }
    }

    public addBinding(binding: AxisBinding) {
        this.bindings.add(binding);
    }

    public removeBinding(binding: AxisBinding) {
        this.bindings.delete(binding);
    }

    public update() {
        this._value = 0;

        for (const binding of this.bindings) {
            for (const key of binding.keys) {
                if (this.isKeyActive(key)) {
                    this._value += binding.value; //TODO: Add custom merge method
                }
            }
        }

        this._value = Math.max(-1, Math.min(1, this._value));
    }

    private isKeyActive(key: KeyBinding) {
        for (const value of key.code) {
            switch (key.type) {
                case "keyboard":
                    if (Input.isKeyPressed(value.toString())) {
                        return true;
                    }
                    break;
                case "mouse":
                    if (Input.isMouseButtonPressed(+value)) {
                        return true;
                    }
                    break;
                case "gamepad":
                    // const gp = navigator.getGamepads()[0];
                    // if (gp) {
                    //     newValue += gp.axes[binding.index] * binding.value;
                    // }
                    new Error("Input device \"Gamepad\" is not implemented.");
                    break;
                //TODO: implement gamepads
            }
        }

    }
}