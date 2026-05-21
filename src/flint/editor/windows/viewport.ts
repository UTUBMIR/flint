import Input from "../../shared/input";
import { Renderer2D } from "../../shared/renderer2d";
import type { IRenderer } from "../../shared/irenderer";
import { System } from "../../runtime/system";
import { BaseEditorWindow, type WindowContext } from "../window-framework";

export default class ViewportWindow extends BaseEditorWindow {
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private readonly renderer: IRenderer;
    private readonly renderCallback: () => void;
    private lastWidth = 0;
    private lastHeight = 0;

    public constructor(context: WindowContext) {
        super(context);
        this.root.className = "panel-content viewport-panel";
        this.root.style.position = "relative";
        this.root.style.overflow = "hidden";

        this.canvas = document.createElement("canvas");
        this.canvas.style.position = "absolute";
        this.canvas.style.left = "0";
        this.canvas.style.top = "0";
        this.root.appendChild(this.canvas);

        const ctx = this.canvas.getContext("2d");
        if (!ctx) {
            throw new Error("Failed to get 2D context for Viewport canvas");
        }
        this.ctx = ctx;
        this.renderer = new Renderer2D();

        this.renderCallback = this.onRender.bind(this);
    }

    public override initialize(): void {
        System.addRenderTarget(this.renderCallback);
        Input.setTargetElement(this.canvas);

        const onPointerDown = (ev: PointerEvent) => {
            // Lock pointer immediately on middle or right button for camera panning
            if ((ev.button === 1 || ev.button === 2) && document.pointerLockElement !== this.canvas) {
                this.canvas.requestPointerLock();
            }
        };

        const onPointerUp = (ev: PointerEvent) => {
            if ((ev.button === 1 || ev.button === 2) && document.pointerLockElement === this.canvas) {
                document.exitPointerLock();
            }
        };

        const onMouseUp = (ev: MouseEvent) => {
            onPointerUp(ev as PointerEvent);
        };

        this.canvas.addEventListener("pointerdown", onPointerDown);
        this.canvas.addEventListener("pointerup", onPointerUp);
        // Fallback: mouseup fires reliably during pointer lock
        this.canvas.addEventListener("mouseup", onMouseUp);

        this.registerCleanup(() => {
            Input.setTargetElement(null);
            if (document.pointerLockElement === this.canvas) {
                document.exitPointerLock();
            }
            this.canvas.removeEventListener("pointerdown", onPointerDown);
            this.canvas.removeEventListener("pointerup", onPointerUp);
            this.canvas.removeEventListener("mouseup", onMouseUp);
            System.removeRenderTarget(this.renderCallback);
            this.canvas.remove();
        });
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

        // Render all layers (including EditorLayer) for viewport
        const world = System.world;
        if (world) {
            world.render(this.ctx, this.renderer);
        }

        // Reset frame movement after navigation consumed it
        Input.resetFrameMovement();
    }
}
