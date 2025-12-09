import Input from "../shared/input";
import type { IRenderer } from "../shared/irenderer";
import { SystemEvent, SystemEventEmitter } from "./system-event";
import playConfig from "./config/play-config.json" with { type: 'json' };
import type { AxisBinding } from "../shared/input-axis";
import InputAxis from "../shared/input-axis";
import type Component from "./component";
import type Layer from "./layer";

//default components
import Camera from "./components/camera";
import Shape from "./components/shape";
import type GameObject from "./game-object";

export type UUID = `${string}-${string}-${string}-${string}-${string}`;


export type Canvas = {
    element: HTMLCanvasElement,
    ctx: RenderingContext
}

type PlayConfig = {
    input: { name: string, bindings: { value: number, keys: { type: string, code: string[] }[] }[] }[]
}

export enum RunningState {
    Stopped,
    Running,
    RunningRenderingOnly
}

export class System {
    public static layers: Layer[] = [];
    public static components = new Map<string, typeof Component>();

    public static showColliders: boolean = false;
    public static readonly dpr = window.devicePixelRatio || 1;

    private static lastFrame: number;
    private static _deltaTime: number;

    private static rootDiv: HTMLDivElement;

    private static readonly renderingContext = CanvasRenderingContext2D; //TODO: move this to a config file
    private static _renderer: IRenderer;
    private static readonly eventEmitter: SystemEventEmitter = new SystemEventEmitter(false, true);

    private static _runningState: RunningState = RunningState.Stopped;

    public static get isRunning(): RunningState {
        return System._runningState;
    }

    public static get deltaTime(): number {
        return this._deltaTime;
    }

    public static get fps(): number {
        return 1 / this._deltaTime;
    }

    public static get renderer(): IRenderer {
        return this._renderer;
    }

    public static setCursor(cursor: string) {
        System.rootDiv.style.cursor = cursor;
    }


    private constructor() { }

    public static getGameObjectById(uuid: UUID): GameObject | undefined {
        for (const layer of System.layers) {
            const found = layer.getObjects().find(go => go.uuid === uuid);
            if (found) {
                return found;
            }
        }
    }

    private static addBasicComponents() {
        this.components.set("Camera", Camera);
        this.components.set("Shape", Shape);
    }

    public static init(renderer: IRenderer): void {
        this.initRootDiv();
        this._renderer = renderer;
        Input.init();
        this.loadPlayConfig(playConfig);

        this.addBasicComponents();

        this.rootDiv.addEventListener('contextmenu', event => event.preventDefault());


        for (const event of ["mousedown", "mouseup", "mousemove", "touchstart", "touchmove", "touchend"]) {
            document.addEventListener(event, this.sendEventToLayers.bind(this));
        }
    }

    public static pushLayer(layer: Layer): void {
        layer.canvas = this.createCanvas();
        layer.renderer = this._renderer;
        this.eventEmitter.addEventListener(layer.onEvent.bind(layer));

        this.layers.push(layer);
        layer.onAttach();
    }

    public static removeLayer(layer: Layer): void {
        const index = System.layers.indexOf(layer);
        if (index !== -1) System.layers.splice(index, 1);
    }

    public static run() {
        requestAnimationFrame(System.mainTick.bind(System));
        System.lastFrame = performance.now();
        System._runningState = RunningState.Running;
    }

    public static runRenderingOnly() {
        requestAnimationFrame(System.renderOnlyTick.bind(System));
        System.lastFrame = performance.now();
        System._runningState = RunningState.RunningRenderingOnly;
    }

    public static stop() {
        System._runningState = RunningState.Stopped;
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

        if (System._runningState === RunningState.Running) {
            requestAnimationFrame(System.mainTick.bind(System));
        }
    }

    private static renderOnlyTick(now: number) {
        this._deltaTime = (now - this.lastFrame) / 1000;
        this.lastFrame = now;

        for (const layer of this.layers) {
            layer.onRender();
        }

        if (System._runningState === RunningState.RunningRenderingOnly) {
            requestAnimationFrame(System.renderOnlyTick.bind(System));
        }
    }

    public static createCanvas(): Canvas {
        const canvas = document.createElement("canvas");
        const ctxName = this.getContextName(this.renderingContext.name);
        const ctx = canvas.getContext(ctxName);

        if (!ctx) {
            throw new Error(`Rendering context ${ctxName} was not found!`);
        }

        this.addResizing(canvas);

        if (ctx instanceof CanvasRenderingContext2D) {
            ctx.scale(System.dpr, System.dpr);
        }

        this.rootDiv.appendChild(canvas);

        return { element: canvas, ctx: ctx };
    }

    private static getContextName(ctxName: string): string {
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
        const ro = new ResizeObserver(() => {
            setTimeout(() => {
                canvas.width = +(this.rootDiv.clientWidth);
                canvas.height = +(this.rootDiv.clientHeight);
            }, 0);
        });
        ro.observe(this.rootDiv);
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