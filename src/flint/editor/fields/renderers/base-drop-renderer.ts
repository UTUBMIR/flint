/* eslint-disable @typescript-eslint/no-explicit-any */
import { BehaviorRegistry } from "../component-builder";
import type { FieldRenderer, GetType, SetType } from "../field-renderer";

export abstract class BaseDropRenderer<T> implements FieldRenderer {
    public abstract canRender(type: string): boolean;

    protected abstract parseDrop(
        dt: DataTransfer,
        root: any,
        path: string[],
        get: GetType
    ): T | null;

    protected abstract stringify(value: T | null): string;

    public render(root: any, path: string[], get: GetType, set: SetType) {
        const valueLabel = document.createElement("div");
        valueLabel.classList.add("drop-value");

        this.update = () => {
            valueLabel.textContent = this.stringify(ctx.get());
        };

        const ctx = {
            get: () => get(root, path) as T | null,
            set: (v: T | null) => set(root, path, v),
            update: this.update
        };

        const dropzone = document.createElement("div");
        dropzone.classList.add("dropzone");
        dropzone.appendChild(valueLabel);

        dropzone.addEventListener("dragover", ev => {
            ev.preventDefault();
            dropzone.classList.add("drag-over");
        });

        dropzone.addEventListener("dragleave", () => {
            dropzone.classList.remove("drag-over");
        });

        dropzone.addEventListener("drop", ev => {
            ev.preventDefault();
            dropzone.classList.remove("drag-over");

            const dt = ev.dataTransfer;
            if (!dt) return;

            const value = this.parseDrop(dt, root, path, get);
            if (value !== null) {
                ctx.set(value);
                ctx.update();
            }
        });

        for (const b of BehaviorRegistry.getBehaviors("drop")) {
            b.attach(dropzone, ctx);
        }

        ctx.update();
        return dropzone;
    }

    public update(): void { }
}
