import { type FieldBehavior, type BehaviorContext } from "../field-behaviour";

export class WheelScrubBehavior implements FieldBehavior {
    private speed = 0.5;
    private shiftMult = 8;
    private ctrlMult = 0.1;

    attach(el: HTMLInputElement, ctx: BehaviorContext) {
        const handleWheel = (ev: WheelEvent) => {
            ev.preventDefault(); // prevent page scroll

            let delta = ev.deltaY * -0.1; // negative so wheel up = increase
            delta *= this.speed;

            if (ev.shiftKey) delta *= this.shiftMult;
            if (ev.ctrlKey) delta *= this.ctrlMult;

            const newValue = (parseFloat(el.value) || 0) + delta;

            ctx.set(newValue);
            ctx.update();
        };

        el.addEventListener("wheel", handleWheel, { passive: false });
    }
}