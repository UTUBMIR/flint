/* eslint-disable @typescript-eslint/no-explicit-any */
import { BehaviorRegistry } from "../../component-builder";
import type { FieldRenderer, GetType, SetType } from "../field-renderer";

import type SlInput from "@shoelace-style/shoelace/dist/components/input/input.js";

export class StringRenderer implements FieldRenderer {
    canRender(type: string) {
        return type === "string";
    }

    render(root: any, path: string[], get: GetType, set: SetType) {
        this.update = () => {
            const newValue = ctx.get();
            if (input.value !== newValue) {
                input.value = newValue;
            }
        };

        const ctx = {
            get: () => get(root, path),
            set: (v: string) => set(root, path, v),
            update: this.update
        };

        const input = document.createElement("sl-input") as SlInput;

        input.addEventListener("sl-input", (e: any) => {
            ctx.set(e.target.value);
        });

        for (const b of BehaviorRegistry.getBehaviors("string")) {
            b.attach(input, ctx);
        }
        ctx.update();

        return input;
    }

    update(): void { }
}
