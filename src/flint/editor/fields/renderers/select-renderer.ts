/* eslint-disable @typescript-eslint/no-explicit-any */
import Metadata, { MetadataKeys } from "../../../shared/metadata";
import type { FieldRenderer, GetType, SetType } from "../field-renderer";

import type SlSelect from "@shoelace-style/shoelace/dist/components/select/select.js";

export class SelectRenderer implements FieldRenderer {
    public canRender(type: string) {
        return type === "select";
    }

    public render(root: any, path: string[], get: GetType, set: SetType) {
        this.update = () => {
            const newValue = String(ctx.get() ?? "");
            if (select.value !== newValue) {
                select.value = newValue;
            }
        };

        const key = path[path.length - 1] ?? "";
        const parent = get(root, path.slice(0, path.length - 1)) ?? root;
        const options = Metadata.getField(parent, key, MetadataKeys.FieldInspectorOptions) as string[] | undefined;

        const ctx = {
            get: () => get(root, path),
            set: (v: string) => set(root, path, v),
            update: this.update
        };

        const select = document.createElement("sl-select") as SlSelect;
        select.hoist = true;

        for (const optionValue of options ?? []) {
            const option = document.createElement("sl-option");
            option.value = optionValue;
            option.textContent = optionValue;
            select.appendChild(option);
        }

        select.addEventListener("sl-change", (e: any) => {
            ctx.set(String(e.target.value ?? ""));
        });

        ctx.update();

        return select;
    }

    public update(): void { }
}
