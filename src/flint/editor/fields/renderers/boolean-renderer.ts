/* eslint-disable @typescript-eslint/no-explicit-any */
import { BehaviorRegistry } from "../../component-builder";
import type { FieldRenderer, GetType, SetType } from "../field-renderer";

import type SlCheckbox from "@shoelace-style/shoelace/dist/components/checkbox/checkbox.js";

export class BooleanRenderer implements FieldRenderer {
    public canRender(type: string) {
        return type === "boolean";
    }

    public render(root: any, path: string[], get: GetType, set: SetType) {
        this.update = () => {
            const value = !!ctx.get();
            if (checkbox.checked !== value) {
                checkbox.checked = value;
            }
        };

        const ctx = {
            get: () => get(root, path),
            set: (v: boolean) => set(root, path, v),
            update: this.update
        };

        const checkbox = document.createElement("sl-checkbox") as SlCheckbox;

        checkbox.addEventListener("sl-input", (e: any) => {
            ctx.set(!!e.target.checked);
        });

        for (const b of BehaviorRegistry.getBehaviors("string")) {
            b.attach(checkbox, ctx);
        }
        ctx.update();

        return checkbox;
    }

    public update(): void { }
}
