import type { IRenderer } from "../shared/irenderer.js";
import Vector2D from "../shared/vector2d.js";
import visualsConfig from "./config/visuals.json" with { type: 'json' };
import type { Color } from "../shared/graphics.js";
import { Rect } from "../shared/primitives.js";
import type { SystemEvent } from "../runtime/system-event.js";


export default abstract class Window {
    public rect: Rect;
    public dragOffset: Vector2D = new Vector2D();
    public static readonly borderWidth = 5;
    protected minSize = new Vector2D(100, 100);
    public static readonly titleBarHeight = 20;

    public get position(): Vector2D {
        return this.rect.position;
    }
    public set position(value: Vector2D) {
        this.rect.position = value;
    }

    public get size(): Vector2D {
        return this.rect.size;
    }
    public set size(value: Vector2D) {
        this.rect.size = value;
    }

    public readonly title: string;

    public constructor(position?: Vector2D, size?: Vector2D, title: string = "new window") {
        this.rect = new Rect(position ?? new Vector2D(), size ?? new Vector2D(100, 100));
        this.title = title;
    }

    public onAttach(): void { };

    public onUpdate(): void { };

    private onRenderInternal(r: IRenderer) {
        r.fillColor = visualsConfig.colors.windowColor as Color;
        r.lineColor = visualsConfig.colors.windowEdgeColor as Color;
        r.lineWidth = Window.borderWidth;
        r.lineJoin = "bevel";

        r.shadowColor = visualsConfig.colors.windowShadowColor as Color;
        r.shadowBlur = 20;

        r.strokeRect(this.position, this.size);
        r.fillRect(this.position, this.size);

        r.fillColor = visualsConfig.colors.titleColor as Color;
        r.fillRect(this.position, new Vector2D(this.rect.width, Window.titleBarHeight));



        r.fillColor = visualsConfig.colors.titleBarItemColor as Color;

        //r.fillRect(this.position.add(this.titlePosition), new Vector2D(120, Window.titleBarHeight));

        r.fillColor = visualsConfig.colors.textColor as Color;
        r.textBaseLine = "middle";
        r.textAlign = "left";
        r.fontSize = 16;


        r.fillText(this.position.add(new Vector2D(5, Window.titleBarHeight / 2)), this.title);
    }

    public onRender(r: IRenderer) {
        this.onRenderInternal(r);

        r.shadowBlur = 0;

        this.onRenderContent(r);
    }

    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public onRenderContent(r: IRenderer): void { };
    
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    public onEvent(event: SystemEvent) {

    }
}