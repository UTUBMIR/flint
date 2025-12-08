import type { SystemEvent } from "../runtime/system-event";
import type { ColorString } from "../shared/graphics";
import type { IRenderer } from "../shared/irenderer";
import { Rect } from "../shared/primitives";
import Vector2D from "../shared/vector2d";
import visualsConfig from "./config/visuals.json" with { type: 'json' };
import { Button } from "./interaction";


export class Toolbar {
    public static readonly height: number = 25;
    public size: Vector2D = new Vector2D();
    public readonly tabs: ToolbarTab[] = [];

    public addTab(item: ToolbarTab) {
        const lastTab = this.tabs[this.tabs.length - 1]?.button.rect;
        if (lastTab) {
            item.button.position.set(lastTab.x + lastTab.width, 0);
        }
        for (let i = 0; i < item.menu.length; ++i) {
            const tab = item.menu[i] as ToolbarTab;

            tab.button.rect.position.y = item.button.rect.position.y + (i + 1) * Toolbar.height;
        }

        this.tabs.push(item);
    }

    public onUpdate() {
        this.size.set(window.innerWidth, Toolbar.height);
    }

    public onRender(r: IRenderer) {
        r.fillColor = visualsConfig.colors.toolbarColor as ColorString;
        r.fillRect(Vector2D.zero, this.size);

        for (const item of this.tabs) {
            item.onRender(r);
        }
    }

    public onEvent(event: SystemEvent) {
        for (const item of this.tabs) {
            item.onEvent(event);
        }
    }
}

export class ToolbarTab {
    public readonly button: Button;
    public menu: ToolbarTab[];
    public open: boolean = false;

    public constructor(name: string, action?: () => void);
    public constructor(name: string, action?: ToolbarTab[]);

    public constructor(name: string, action?: ToolbarTab[] | (() => void)) {
        this.button = new Button(new Rect(0, 0, 100, Toolbar.height), name);

        if (Array.isArray(action)) {
            this.menu = action;
        }
        else {
            this.menu = [];
        }

        if (typeof action === "function") {
            this.onClick = action;
        }

        this.button.onClick = () => {
            this.open = true;
            this.onClick();
        };
    }

    public onRender(r: IRenderer) {
        this.button.onRender(r);
        if (!this.open) return;

        for (const tab of this.menu) {
            tab.onRender(r);
        }
    }

    public onEvent(event: SystemEvent) {
        this.button.onEvent(event);
        if (!this.open) return;

        if ((event.type === "mousedown" || event.type === "touchstart") && event.stopImmediate === false) {
            this.open = false;
        }
        if (event.stopImmediate) return;

        for (const tab of this.menu) {
            tab.onEvent(event);
            if (event.stopImmediate) return;
        }
    }

    public onClick() { }
}

// export class ToolbarMenu {
//     public readonly tabs: ToolbarTab[] = [];

//     public addTab(item: ToolbarTab) {
//         this.tabs.push(item);
//     }

//     public onUpdate() {
//         this.size.set(window.innerWidth, Toolbar.height);
//     }

//     public onRender(r: IRenderer) {
//         r.fillColor = visualsConfig.colors.toolbarColor as Color;
//         r.fillRect(Vector2D.zero, this.size);

//         for (const item of this.tabs) {
//             item.onRender(r);
//         }
//     }

//     public onEvent(event: SystemEvent) {
//         for (const item of this.tabs) {
//             item.onEvent(event);
//         }
//     }
// }