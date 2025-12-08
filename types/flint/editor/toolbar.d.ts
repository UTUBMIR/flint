import type { SystemEvent } from "../runtime/system-event";
import type { IRenderer } from "../shared/irenderer";
import Vector2D from "../shared/vector2d";
import { Button } from "./interaction";
export declare class Toolbar {
    static readonly height: number;
    size: Vector2D;
    readonly tabs: ToolbarTab[];
    addTab(item: ToolbarTab): void;
    onUpdate(): void;
    onRender(r: IRenderer): void;
    onEvent(event: SystemEvent): void;
}
export declare class ToolbarTab {
    readonly button: Button;
    menu: ToolbarTab[];
    open: boolean;
    constructor(name: string, action?: () => void);
    constructor(name: string, action?: ToolbarTab[]);
    onRender(r: IRenderer): void;
    onEvent(event: SystemEvent): void;
    onClick(): void;
}
