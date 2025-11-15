import type { SystemEvent } from "../runtime/system-event.js";
import type { IRenderer } from "../shared/irenderer.js";
import Window from "./window.js";

export default class DockContainer extends Window {
    public windows: Window[] = [];
    public activeWindow: number = 0;

    public getActiveWindow(): Window | undefined {
        return this.windows[this.activeWindow];
    }

    public setActiveWindow(window: Window): void {
        const idx = this.windows.indexOf(window);
        if (idx !== -1) {
            this.activeWindow = idx;
        }
    }

    public addWindow(window: Window): void {
        window.titlePosition.set(this.windows.length * 120, 0);
        window.dockContainer = this;
        this.windows.push(window);
    }

    public removeWindow(window: Window): void {
        window.titlePosition.set(0, 0);
        window.dockContainer = undefined;

        this.windows.splice(this.windows.indexOf(window), 1);
        if (this.activeWindow === this.windows.length) --this.activeWindow;
    }

    public onRender(r: IRenderer): void {
        const active = this.getActiveWindow();

        // 1. Рендеримо активне вікно
        if (active) {
            active.onRender(r);
        }

        // 2. Рендеримо всі інші
        for (let i = 0; i < this.windows.length; i++) {
            if (i === this.activeWindow) continue;
            this.windows[i]?.onRender(r);
        }
    }

    public onUpdate(): void {
        // Вирівнювання позицій
        const last = this.windows[this.windows.length - 1];
        if (!last) return;

        for (const window of this.windows) {
            window.position = last.position.copy();
            window.size = last.size.copy();
        }

        for (const window of this.windows) {
            window.onUpdate();
        }
    }

    public onEvent(event: SystemEvent): void {
        for (const window of this.windows) {
            window.onEvent(event);
        }
    }
}