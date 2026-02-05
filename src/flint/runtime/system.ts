import Input from "../shared/input";
import type { IRenderer } from "../shared/irenderer";
import { SystemEvent, SystemEventEmitter } from "./system-event";
import defaultPlayConfig from "./config/play-config.json" with { type: 'json' };
import type { AxisBinding } from "../shared/input-axis";
import InputAxis from "../shared/input-axis";
import type Component from "./component";

//default components
import type RendererComponent from "./renderer-component";

import { type AbstractFileSystem } from "../shared/file-system";
import { TimerSystem } from "./timers";
import Vector2 from "../shared/vector2";
import type { World } from "./world";

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
    RunningPaused,
    RunningRenderingOnly
}

export class RenderSystem {
    private components: RendererComponent[] = [];

    public register(component: RendererComponent) {
        this.components.push(component);
    }

    public unregister(component: RendererComponent) {
        const index = this.components.indexOf(component);
        if (index !== -1) this.components.splice(index, 1);
    }

    public render(renderer: IRenderer) {
        for (let i = 0; i < this.components.length; ++i) {
            this.components[i]!.render(renderer);
        }
    }
}


export class System {
    private static _world: World;


    public static get world() {
        return System._world;
    }

    public static components = new Map<string, typeof Component>();

    public static showColliders: boolean = false;
    public static readonly dpr = window.devicePixelRatio || 1;

    private static lastFrame: number;
    private static _deltaTime: number;

    private static rootDiv: HTMLDivElement;

    public static get rootSize(): Vector2 {
        return new Vector2(this.rootDiv.clientWidth, this.rootDiv.clientHeight);
    }

    private static readonly renderingContext = CanvasRenderingContext2D; //TODO: move this to a config file
    private static _renderer: IRenderer;
    public static readonly eventEmitter: SystemEventEmitter = new SystemEventEmitter(false, true);

    private static _runningState: RunningState = RunningState.Stopped;
    private static _rafId: number | null = null;

    public static readonly audioContext = new AudioContext();
    public static fileSystem: AbstractFileSystem;

    public static get runningState(): RunningState {
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


    public static registerComponent(name: string, component: typeof Component) {
        System.components.set(name, component);
    }

    private static setupAudio() {
        document.addEventListener("click", () => System.audioContext.resume());
    }


    public static init(options: {
        renderer: IRenderer,
        fileSystem?: AbstractFileSystem,
        playConfig?: PlayConfig,
        world: World
    }): void {
        System._world = options.world;
        this.initRootDiv();
        this._renderer = options.renderer;
        Input.init(System.rootDiv);

        this.loadPlayConfig(options.playConfig ?? defaultPlayConfig);

        if (options.fileSystem) {
            this.fileSystem = options.fileSystem;
        }

        this.rootDiv.addEventListener('contextmenu', event => event.preventDefault());

        for (const event of ["pointerdown", "pointermove", "pointerup"]) {
            document.addEventListener(event, this.sendEventToLayers.bind(this));
        }

        if (!crypto.randomUUID) {
            crypto.randomUUID = function () {
                return Math.random().toString() + performance.now() as UUID;
            };
        }

        document.addEventListener("visibilitychange", () => {
            if (document.hidden) {
                TimerSystem.pause();
                System.cancelMainTick();

                if (System._runningState === RunningState.Running) {
                    System._runningState = RunningState.RunningPaused;
                }
            } else {
                TimerSystem.resume();

                if (System._runningState === RunningState.RunningPaused) {
                    System._runningState = RunningState.Running;
                    System.lastFrame = performance.now();
                    System.scheduleMainTick();
                }
            }
        });

        System.setupAudio();
    }

    public static run(sendStart = true) {
        if (System._runningState === RunningState.Running) return;

        System._world.start(sendStart);

        System.lastFrame = performance.now();
        System._runningState = RunningState.Running;
        System.scheduleMainTick();
    }

    public static stop() {
        System._runningState = RunningState.Stopped;
        System.cancelMainTick();
        System._world.stop();
    }

    public static runRenderingOnly() {
        System.lastFrame = performance.now();
        requestAnimationFrame(System.renderOnlyTick);
        System._runningState = RunningState.RunningRenderingOnly;
        System._world.stop();
    }


    private static scheduleMainTick() {
        if (System._rafId !== null) return;
        System._rafId = requestAnimationFrame(System.mainTick);
    }


    private static cancelMainTick() {
        if (System._rafId !== null) {
            cancelAnimationFrame(System._rafId);
            System._rafId = null;
        }
    }

    private static mainTick() {
        System._rafId = null;

        if (System._runningState !== RunningState.Running) {
            return;
        }

        const now = performance.now();
        System._deltaTime = (now - System.lastFrame) / 1000;
        System.lastFrame = now;

        System._world.update();
        System._world.render();

        TimerSystem.update(System._deltaTime);

        System.scheduleMainTick();
    }

    private static renderOnlyTick(now: number) {
        System._deltaTime = (now - System.lastFrame) / 1000;
        System.lastFrame = now;

        System._world.render();

        if (System._runningState === RunningState.RunningRenderingOnly) {
            requestAnimationFrame(System.renderOnlyTick);
        }
    }

    public static createCanvas(): Canvas {
        const canvas = document.createElement("canvas");
        const ctxName = System.getContextName(System.renderingContext.name);
        const ctx = canvas.getContext(ctxName);

        if (!ctx) {
            throw new Error(`Rendering context ${ctxName} was not found!`);
        }

        System.addResizing(canvas, ctx);

        System.rootDiv.appendChild(canvas);

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

    private static addResizing(canvas: HTMLCanvasElement, ctx: RenderingContext) {
        const resize = () => {
            const width = System.rootDiv.clientWidth;
            const height = System.rootDiv.clientHeight;

            canvas.width = Math.floor(width * System.dpr);
            canvas.height = Math.floor(height * System.dpr);

            canvas.style.width = width + "px";
            canvas.style.height = height + "px";

            if (ctx instanceof CanvasRenderingContext2D) {
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.scale(System.dpr, System.dpr);
            }
        };

        const ro = new ResizeObserver(() => {
            setTimeout(() => {
                resize();
            }, 0);
        });

        resize();
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
        if (event.type === "pointermove") {
            System.setCursor("initial");
        }

        System.eventEmitter.dispatchEvent(new SystemEvent(event.type));
    }

    private static loadPlayConfig(config: PlayConfig) {
        Input.inputAxes = config.input.map(axis => new InputAxis(axis.name, axis.bindings as AxisBinding[]));
    }
}