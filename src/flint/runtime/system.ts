import Input from "../shared/input";
import type { IRenderer } from "../shared/irenderer";
import { SystemEvent, SystemEventEmitter } from "./system-event";
import defaultPlayConfig from "./config/play-config.json" with { type: 'json' };
import type { AxisBinding } from "../shared/input-axis";
import InputAxis from "../shared/input-axis";
import type Component from "./component";
import Metadata, { MetadataKeys } from "../shared/metadata";

//default components
import type RendererComponent from "./renderer-component";
import type Camera from "./components/camera";

import { type AbstractFileSystem } from "../shared/file-system";
import { TimerSystem } from "./timers";
import Vector2 from "../shared/vector2";
import type { World } from "./world";
import Transform from "./transform";

export type UUID = `${string}-${string}-${string}-${string}-${string}`;

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

    /** The camera currently rendering this system's components. */
    public currentCamera: Camera | null = null;

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

    private static readonly renderTargets: Set<() => void> = new Set();

    private static _rootSize = new Vector2();
    public static get rootSize(): Vector2 {
        return System._rootSize;
    }

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

    public static setCursor(cursor: string) {
        document.body.style.cursor = cursor;
    }

    public static addRenderTarget(callback: () => void): void {
        System.renderTargets.add(callback);
    }

    public static removeRenderTarget(callback: () => void): void {
        System.renderTargets.delete(callback);
    }

    private constructor() { }


    public static registerComponent(name: string, component: typeof Component) {
        System.components.set(name, component);

        if (Metadata.enabled && Metadata.getClass(component.prototype, MetadataKeys.EditorName, false) === undefined) {
            Metadata.setClass(component.prototype, MetadataKeys.EditorName, name);
        }
    }

    public static getComponentName(component: typeof Component | Component) {
        const base = typeof component === "function" ? component : component.constructor;
        const metadataName = typeof component === "function"
            ? Metadata.getClass(component.prototype, MetadataKeys.EditorName, false)
            : Metadata.getClass(component, MetadataKeys.EditorName);

        if (metadataName) {
            return metadataName;
        }

        for (const [name, value] of System.components) {
            if (value === base) {
                return name;
            }
        }

        if (base === Transform) {
            return "Transform";
        }

        return "Unknown";
    }

    private static setupAudio() {
        function listener() {
            System.audioContext.resume();
            document.removeEventListener("click", listener);
        }
        document.addEventListener("click", listener);
    }


    public static init(options: {
        fileSystem?: AbstractFileSystem,
        playConfig?: PlayConfig,
        world: World
    }): void {
        System._world = options.world;
        Input.init();

        this.loadPlayConfig(options.playConfig ?? defaultPlayConfig);

        if (options.fileSystem) {
            this.fileSystem = options.fileSystem;
        }

        document.addEventListener('contextmenu', event => event.preventDefault());

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

        for (const target of System.renderTargets) {
            target();
        }

        TimerSystem.update(System._deltaTime);

        System.scheduleMainTick();
    }

    private static renderOnlyTick(now: number) {
        System._deltaTime = (now - System.lastFrame) / 1000;
        System.lastFrame = now;

        for (const target of System.renderTargets) {
            target();
        }

        if (System._runningState === RunningState.RunningRenderingOnly) {
            requestAnimationFrame(System.renderOnlyTick);
        }
    }

    public static createCanvas(width: number, height: number): { element: HTMLCanvasElement, ctx: CanvasRenderingContext2D } {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        if (!ctx) {
            throw new Error("2D rendering context was not found!");
        }

        canvas.width = Math.floor(width * System.dpr);
        canvas.height = Math.floor(height * System.dpr);
        canvas.style.width = width + "px";
        canvas.style.height = height + "px";
        ctx.scale(System.dpr, System.dpr);

        return { element: canvas, ctx };
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
