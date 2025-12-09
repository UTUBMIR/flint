import type { IRenderer } from "../shared/irenderer";
import type Component from "./component";
import type Layer from "./layer";
import type GameObject from "./game-object";
export type UUID = `${string}-${string}-${string}-${string}-${string}`;
export type Canvas = {
    element: HTMLCanvasElement;
    ctx: RenderingContext;
};
export declare enum RunningState {
    Stopped = 0,
    Running = 1,
    RunningRenderingOnly = 2
}
export declare class System {
    static layers: Layer[];
    static components: Map<string, typeof Component>;
    static showColliders: boolean;
    static readonly dpr: number;
    private static lastFrame;
    private static _deltaTime;
    private static rootDiv;
    private static readonly renderingContext;
    private static _renderer;
    private static readonly eventEmitter;
    private static _runningState;
    static get isRunning(): RunningState;
    static get deltaTime(): number;
    static get fps(): number;
    static get renderer(): IRenderer;
    static setCursor(cursor: string): void;
    private constructor();
    static getGameObjectById(uuid: UUID): GameObject | undefined;
    private static addBasicComponents;
    static init(renderer: IRenderer): void;
    static pushLayer(layer: Layer): void;
    static removeLayer(layer: Layer): void;
    static run(): void;
    static runRenderingOnly(): void;
    static stop(): void;
    private static mainTick;
    private static renderOnlyTick;
    static createCanvas(): Canvas;
    private static getContextName;
    private static addResizing;
    private static initRootDiv;
    private static sendEventToLayers;
    private static loadPlayConfig;
}
