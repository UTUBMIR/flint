/* eslint-disable @typescript-eslint/no-explicit-any */
import { BehaviorRegistry } from "../../component-builder";
import type { FieldRenderer, GetType, SetType } from "../field-renderer";

export class DropRenderer implements FieldRenderer {
    canRender(type: string) {
        return type === "drop";
    }

    render(root: any, path: string[], get: GetType, set: SetType) {
        this.update = () => {
            // const newValue = ctx.get();
        };

        const ctx = {
            get: () => get(root, path),
            set: (v: string) => set(root, path, v),
            update: this.update
        };

        const input = document.createElement("div");
        input.classList.add("dropzone");

        input.addEventListener("dragover", (ev) => {
            ev.preventDefault();
        });

        input.addEventListener("drop", (ev) => {
            ev.preventDefault();

            ev.dataTransfer!.items[0]?.getAsString((value) => {
                ctx.set(value);
            });
        });

        for (const b of BehaviorRegistry.getBehaviors("drop")) {
            b.attach(input, ctx);
        }
        ctx.update();

        return input;
    }

    update(): void { }
}
