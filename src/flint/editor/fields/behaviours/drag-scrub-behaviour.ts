import { type FieldBehavior, type BehaviorContext } from "../field-behaviour";

export class DragScrubBehavior implements FieldBehavior {
    private dragSpeed = 0.5;
    private shiftMult = 8;
    private ctrlMult = 0.1;

    attach(el: HTMLInputElement, ctx: BehaviorContext) {
        let dragging = false;
        let startValue = 0;
        let usingPointerLock = false;
        let skipFirstLockedMove = false;

        const EDGE_THRESHOLD = 4; // px from screen edge before locking pointer
        const DRAG_THRESHOLD = 3; // px movement before starting scrub

        let startX = 0;
        let moved = false;

        const shouldLockPointer = (x: number) => x <= EDGE_THRESHOLD || x >= window.innerWidth - EDGE_THRESHOLD;

        const handleMouseMove = (ev: MouseEvent) => {
            if (!dragging) return;

            // Track total movement to decide when scrubbing starts
            if (!moved) {
                const dx = ev.clientX - startX;
                if (Math.abs(dx) < DRAG_THRESHOLD) return;
                moved = true;
            }

            // Enter pointer lock only if near edges
            if (!usingPointerLock && shouldLockPointer(ev.clientX)) {
                usingPointerLock = true;
                skipFirstLockedMove = true;
                el.requestPointerLock();
                return;
            }

            // Skip first pointer-lock event to prevent jump
            if (usingPointerLock && skipFirstLockedMove) {
                skipFirstLockedMove = false;
                return;
            }

            let delta = ev.movementX;
            delta *= this.dragSpeed;
            if (ev.shiftKey) delta *= this.shiftMult;
            if (ev.ctrlKey) delta *= this.ctrlMult;

            const newValue = startValue + delta;
            startValue = newValue;

            ctx.set(newValue);
            ctx.update();
        };

        const stopDragging = () => {
            dragging = false;
            moved = false;

            if (usingPointerLock) {
                usingPointerLock = false;
                document.exitPointerLock();
            }

            window.removeEventListener("mousemove", handleMouseMove);
            window.removeEventListener("mouseup", stopDragging);
        };

        el.addEventListener("mousedown", (ev: MouseEvent) => {
            if (ev.button !== 0) return;

            startX = ev.clientX;
            startValue = parseFloat(el.value) || 0;
            moved = false;
            dragging = true;
            usingPointerLock = false;
            skipFirstLockedMove = false;

            window.addEventListener("mousemove", handleMouseMove);
            window.addEventListener("mouseup", stopDragging);
        });
    }
}
