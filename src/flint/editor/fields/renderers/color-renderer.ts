/* eslint-disable @typescript-eslint/no-explicit-any */
import { BehaviorRegistry } from "../../component-builder";
import type { FieldRenderer, GetType, SetType } from "../field-renderer";
import SlColorPicker from "@shoelace-style/shoelace/dist/components/color-picker/color-picker.js";


export class ColorRenderer implements FieldRenderer {
    canRender(type: string) {
        return type === "color";
    }

    render(root: any, path: string[], get: GetType, set: SetType) {
        this.update = () => {
            const newValue = ctx.get();
            if (picker.value !== newValue) {
                picker.value = newValue;
            }
        };

        const ctx = {
            get: () => get(root, path),
            set: (v: number) => set(root, path, v),
            update: this.update
        };

        const picker = document.createElement("sl-color-picker") as SlColorPicker;
        picker.noFormatToggle = true;
        picker.hoist = true;

        picker.addEventListener("sl-input", (e: any) => ctx.set(e.target.value));

        for (const b of BehaviorRegistry.getBehaviors("color")) {
            b.attach(picker, ctx);
        }
        ctx.update();

        return picker;
    }

    update(): void { }
}