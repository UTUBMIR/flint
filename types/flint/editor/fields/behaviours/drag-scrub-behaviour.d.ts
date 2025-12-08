import { type FieldBehavior, type BehaviorContext } from "../field-behaviour";
export declare class DragScrubBehavior implements FieldBehavior {
    private dragSpeed;
    private shiftMult;
    private ctrlMult;
    attach(el: HTMLInputElement, ctx: BehaviorContext): void;
}
