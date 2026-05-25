import { Renderer2D } from "@flint/shared/renderer2d";
import type { IRenderer } from "@flint/shared/irenderer";
import { System } from "@flint/runtime/system";
import { EditorLayer } from "../editor-layer";
import { BaseEditorWindow, type WindowContext } from "../ui/window-framework";
import Camera from "@flint/runtime/components/camera";
import type Layer from "@flint/runtime/layer";

export default class GameWindow extends BaseEditorWindow {
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private readonly renderer: IRenderer;
    private readonly renderCallback: () => void;
    private lastWidth = 0;
    private lastHeight = 0;

    public constructor(context: WindowContext) {
        super(context);
        this.root.className = "panel-content game-panel";
        this.root.style.position = "relative";
        this.root.style.overflow = "hidden";

        this.canvas = document.createElement("canvas");
        this.canvas.style.position = "absolute";
        this.canvas.style.left = "0";
        this.canvas.style.top = "0";
        this.root.appendChild(this.canvas);

        const ctx = this.canvas.getContext("2d");
        if (!ctx) {
            throw new Error("Failed to get 2D context for Game canvas");
        }
        this.ctx = ctx;
        this.renderer = new Renderer2D();

        this.renderCallback = this.onRender.bind(this);
    }

    public override initialize(): void {
        System.addRenderTarget(this.renderCallback);
        this.registerCleanup(() => {
            System.removeRenderTarget(this.renderCallback);
            this.canvas.remove();
        });
    }

    private static findFirstEnabledCamera(layers: readonly Layer[]): Camera | undefined {
        for (const layer of layers) {
            for (const obj of layer.getObjects()) {
                const camera = obj.getComponent(Camera);
                if (camera && camera.enabled) return camera;
            }
        }
        return undefined;
    }

    private onRender(): void {
        const dpr = System.dpr;
        const width = this.root.clientWidth;
        const height = this.root.clientHeight;

        if (width === 0 || height === 0) return;

        if (width !== this.lastWidth || height !== this.lastHeight) {
            this.lastWidth = width;
            this.lastHeight = height;
            this.canvas.width = Math.floor(width * dpr);
            this.canvas.height = Math.floor(height * dpr);
            this.canvas.style.width = width + "px";
            this.canvas.style.height = height + "px";
        }

        // Reset and apply DPR scaling
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.scale(dpr, dpr);

        this.renderer.setCanvas(this.canvas, this.ctx);

        // Clear canvas
        this.ctx.save();
        this.ctx.resetTransform();
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.restore();

        const world = System.world;
        if (!world) return;

        const gameLayers = world.getLayers().filter(l => !(l instanceof EditorLayer));

        // Find and render from the first enabled game camera
        const gameCamera = GameWindow.findFirstEnabledCamera(gameLayers);
        if (gameCamera) {
            gameCamera.renderLayers(this.ctx, this.renderer, gameLayers);
        }
    }
}
