/* eslint-disable @typescript-eslint/no-explicit-any */
import { BehaviorRegistry } from "../../component-builder";
import type { FieldRenderer, GetType, SetType } from "../field-renderer";

export class NumberRenderer implements FieldRenderer {
    canRender(type: string) {
        return type === "number";
    }

    render(root: any, path: string[], get: GetType, set: SetType) {
        this.update = () => {
            const newValue = (+ctx.get().toFixed(6)).toString();
            if (input.value !== newValue) {
                input.value = newValue;
            }
        };

        const ctx = {
            get: () => get(root, path),
            set: (v: number) => set(root, path, v),
            update: this.update
        };

        const input = document.createElement("sl-input") as any;
        input.type = "number";
        input.step = 10;

        input.addEventListener("sl-input", (e: any) => {
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) ctx.set(v);
            if (e.target.value === "") ctx.set(0);
        });

        for (const b of BehaviorRegistry.getBehaviors("number")) {
            b.attach(input, ctx);
        }
        ctx.update();

        return input;
    }

    update(): void { }
}
