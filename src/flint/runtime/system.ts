import type { ILayer } from "../shared/ilayer.js";
import Input from "../shared/input.js";
import type { IRenderer } from "../shared/irenderer.js";
import { SystemEvent, SystemEventEmitter } from "./system-event.js";
import playConfig from "./config/play-config.json" with { type: 'json' };
import type { AxisBinding } from "../shared/input-axis.js";
import InputAxis from "../shared/input-axis.js";

export type Canvas = {
    element: HTMLCanvasElement,
    ctx: RenderingContext
}

type PlayConfig = {
    input: { name: string, bindings: { value: number, keys: { type: string, code: string[] }[] }[] }[]
}

export class System {
    public static layers: ILayer[] = [];


    public static showColliders: boolean = false;
    public static readonly dpi = window.devicePixelRatio;

    private static lastFrame: number;
    private static _deltaTime: number;

    private static rootDiv: HTMLDivElement;

    private static readonly renderingContext = CanvasRenderingContext2D; //TODO: move this to a config file
    private static _renderer: IRenderer;
    private static readonly eventEmitter: SystemEventEmitter = new SystemEventEmitter(false, true);

    public static get deltaTime(): number {
        return this._deltaTime;
    }

    public static get fps(): number {
        return 1 / this._deltaTime;
    }

    public static get renderer(): IRenderer {
        return this._renderer;
    }


    private constructor() { }

    public static init(renderer: IRenderer): void {
        this.initRootDiv();
        this._renderer = renderer;
        Input.init();
        this.loadPlayConfig(playConfig);

        document.addEventListener('contextmenu', event => event.preventDefault());


        for (const event of ["mousedown", "mouseup", "mousemove", "touchstart", "touchmove", "touchend"]) {
            document.addEventListener(event, this.sendEventToLayers.bind(this));
        }
    }

    public static pushLayer(layer: ILayer): void {
        layer.canvas = this.createCanvas();
        layer.renderer = this._renderer;
        this.eventEmitter.addEventListener(layer.onEvent.bind(layer));

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

    private static sendEventToLayers(event: Event): void {
        this.eventEmitter.dispatchEvent(new SystemEvent(event.type));
    }

    private static loadPlayConfig(config: PlayConfig) {
        Input.inputAxes = config.input.map(axis => new InputAxis(axis.name, axis.bindings as AxisBinding[]));
    }
}