import { type FieldBehavior, type BehaviorContext } from "../field-behaviour";
export declare class WheelScrubBehavior implements FieldBehavior {
    private speed;
    private shiftMult;
    private ctrlMult;
    attach(el: HTMLInputElement, ctx: BehaviorContext): void;
}
