/* eslint-disable @typescript-eslint/no-explicit-any */
import { BehaviorRegistry } from "../component-builder";
import type { FieldRenderer, GetType, SetType } from "../field-renderer";
import Metadata, { MetadataKeys } from "@flint/shared/metadata";

import type SlInput from "@shoelace-style/shoelace/dist/components/input/input.js";
import type SlRange from "@shoelace-style/shoelace/dist/components/range/range.js";

export class NumberRenderer implements FieldRenderer {
    public canRender(type: string) {
        return type === "number";
    }

    public render(root: any, path: string[], get: GetType, set: SetType) {
        const key = path[path.length - 1] ?? "";
        const parent = get(root, path.slice(0, path.length - 1)) ?? root;
        const rangeOptions = Metadata.getField(parent, key, MetadataKeys.FieldInspectorRange) as
            { min: number | null; max: number | null } | undefined;
        const hasSlider = rangeOptions?.min != null && rangeOptions?.max != null;

        const clamp = (v: number): number => {
            if (rangeOptions) {
                if (rangeOptions.min != null) v = Math.max(rangeOptions.min, v);
                if (rangeOptions.max != null) v = Math.min(rangeOptions.max, v);
            }
            return v;
        };

        const ctx = {
            get: () => get(root, path),
            set: (v: number) => set(root, path, clamp(v)),
            update: this.update
        };

        // --- Number input (common to all modes) ---
        const input = document.createElement("sl-input") as SlInput;
        input.type = "number";
        input.step = 10;
        if (rangeOptions?.min != null) input.min = String(rangeOptions.min);
        if (rangeOptions?.max != null) input.max = String(rangeOptions.max);

        input.addEventListener("sl-input", (e: any) => {
            const v = parseFloat(e.target.value);
            if (!Number.isNaN(v)) ctx.set(v);
            if (e.target.value === "") ctx.set(clamp(0));
        });

        for (const b of BehaviorRegistry.getBehaviors("number")) {
            b.attach(input, ctx);
        }

        // --- Slider (only when both bounds are finite) ---
        let slider: SlRange | null = null;
        if (hasSlider) {
            slider = document.createElement("sl-range") as SlRange;
            slider.min = rangeOptions!.min!;
            slider.max = rangeOptions!.max!;
            slider.step = 0.01;

            slider.addEventListener("sl-input", () => {
                const v = slider!.value;
                input.value = (+v.toFixed(6)).toString();
                ctx.set(v);
            });
        }

        // --- Update wiring (set after ctx so lambda captures the final this.update) ---
        this.update = () => {
            const raw = ctx.get();
            const clamped = clamp(+raw);
            const display = (+clamped.toFixed(6)).toString();
            if (input.value !== display) {
                input.value = display;
            }
            if (slider && slider.value !== clamped) {
                slider.value = clamped;
            }
        };

        ctx.update();

        // --- Layout ---
        if (slider) {
            const container = document.createElement("div");
            container.style.display = "flex";
            container.style.alignItems = "center";
            container.style.gap = "8px";

            slider.style.flex = "1";
            input.style.width = "100px";
            input.style.flexShrink = "0";

            container.appendChild(slider);
            container.appendChild(input);
            return container;
        }

        return input;
    }

    public update(): void { }
}
