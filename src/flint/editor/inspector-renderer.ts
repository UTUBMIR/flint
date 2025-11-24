import type Component from "../runtime/component";
import type { SystemEvent } from "../runtime/system-event";
import type { Color } from "../shared/graphics";
import type { IRenderer } from "../shared/irenderer";
import { Rect } from "../shared/primitives";
import Vector2D from "../shared/vector2d";
import visualsConfig from "./config/visuals.json" with { type: 'json' };

export class InspectorComponent {
    public rect: Rect = new Rect(0, 0, 0, 50);
    public ir: InspectorRenderer;
    public component: Component;

    public constructor(component: Component, ir: InspectorRenderer) {
        this.component = component;
        this.ir = ir;
    }

    public onRender(r: IRenderer) {
        this.ir.renderer = r;
        this.ir.position = this.rect.position.add(new Vector2D(0, 2));

        for (const [name, value] of Object.entries(this.component)) {
            if (typeof value === "object") {
                this.ir.label(name);
                for (const [name, v] of Object.entries(value)) {
                    this.ir.field(name, v);
                }
            }
            else {
                this.ir.field(name, value);
            }
        }

        this.rect.size = this.ir.position.subtract(this.rect.position);
    }

    public onEvent(event: SystemEvent) {

    }
}

export class InspectorRenderer {
    public position: Vector2D;
    public renderer: IRenderer;

    public constructor(renderer: IRenderer, position?: Vector2D) {
        this.renderer = renderer;
        this.position = position ?? new Vector2D();
    }

    public label(text: string) {
        this.position.y += 15;
        this.renderer.fillColor = visualsConfig.colors.textColor as Color;
        this.renderer.textAlign = "start";
        this.renderer.textBaseLine = "top";
        this.renderer.fontSize = 20;

        this.renderer.fillText(this.position, text);
        this.position.y += 30;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public field(text: string, value: any) {
        this.renderer.fillColor = visualsConfig.colors.toolbarTab as Color;
        this.renderer.fillRect(this.position.add(new Vector2D(145, -2)), new Vector2D(200, 17));
        this.renderer.fillColor = visualsConfig.colors.textColor as Color;
        this.renderer.textAlign = "start";
        this.renderer.textBaseLine = "top";
        this.renderer.fontSize = 16;

        this.renderer.fillText(this.position, text);
        // if (value && Object.hasOwn(value, "onRenderInspector")) {
        //     value.call("onRenderInspector", this);
        // }
        // else {
        this.renderer.fillText(this.position.add(new Vector2D(150, 0)), value);
        // }
        this.position.y += 20;
    }
}