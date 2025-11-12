import type { IRenderer } from "./irenderer.js";
import Layer from "./layer.js";


export type Canvas = {
    element: HTMLCanvasElement,
    ctx: RenderingContext
}

export class System {
    public static layers: Layer[] = [];


    public static showColliders: boolean = false;

    public static get deltaTime(): number {
        return this._deltaTime;
    }

    public static get fps(): number {
        return 1 / this._deltaTime;
    }


    private static lastFrame: number;
    private static _deltaTime: number;

    private static rootDiv: HTMLDivElement;

    private static readonly renderingContext = CanvasRenderingContext2D; //TODO: move this to a config file
    private static renderer: IRenderer;


    private constructor() { }

    public static init(renderer: IRenderer): void {
        this.initRootDiv();
        this.renderer = renderer;
    }

    public static pushLayer(layer: Layer): void {
        layer.canvas = this.createCanvas();
        layer.renderer = this.renderer;

        this.layers.push(layer);
        layer.onAttach();
    }

    public static run() {
        requestAnimationFrame(this.mainTick.bind(this));
        this.lastFrame = performance.now();
    }

    private static mainTick(now: number) {
        this._deltaTime = (now - this.lastFrame) / 1000;
        this.lastFrame = now;

        for (const layer of this.layers) {
            layer.onUpdate();
        }

        for (const layer of this.layers) {
            layer.onRender();
        }

        requestAnimationFrame(this.mainTick.bind(this));
    }

    public static createCanvas(): Canvas {
        const canvas = document.createElement("canvas");
        const ctxName = this.getContextName(canvas, this.renderingContext.name);
        const ctx = canvas.getContext(ctxName);

        if (!ctx) {
            throw new Error(`Rendering context ${ctxName} was not found!`);
        }

        this.addResizing(canvas);

        this.rootDiv.appendChild(canvas);

        return { element: canvas, ctx: ctx };
    }

    private static getContextName(canvas: HTMLCanvasElement, ctxName: string): string {
        switch (ctxName) {
            case CanvasRenderingContext2D.name:
                return "2d";
            case WebGLRenderingContext.name:
                return "webgl";
            case WebGL2RenderingContext.name:
                return "webgl2";
            default:
                throw new Error(`Unsupported context type: "${ctxName}"`);
        }
    }

    private static addResizing(canvas: HTMLCanvasElement) {
        const resize = () => {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        };

        resize();
        window.addEventListener("resize", resize);
    }

    private static initRootDiv(id: string = "root") {
        const div = document.getElementById(id);
        if (!div || !(div instanceof HTMLDivElement)) {
            throw new Error(`Html element with type "div" and id "${id}" was not found!`);
        }

        this.rootDiv = div;
    }
}