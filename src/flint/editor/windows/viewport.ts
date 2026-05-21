import Input from "../../shared/input";
import { Renderer2D } from "../../shared/renderer2d";
import type { IRenderer } from "../../shared/irenderer";
import { System } from "../../runtime/system";
import { SystemEvent } from "../../runtime/system-event";
import { BaseEditorWindow, type WindowContext } from "../window-framework";
import { EditorLayer, viewportPressedKeys, viewportPressedMouseButtons, viewportFrameMovement } from "../editor-layer";
import Camera from "../../runtime/components/camera";
import type Layer from "../../runtime/layer";

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

        this.canvas.tabIndex = -1;
        this.canvas.style.outline = "none";

        // Cache the editor layer for dispatching events directly (skip System.eventEmitter → game layers)
        const world = System.world;
        const editorLayer = world?.getLayers().find(l => l instanceof EditorLayer) as EditorLayer | undefined;

        const stop = (ev: Event) => ev.stopPropagation();

        const sendToEditorLayer = (type: string) => {
            if (type === "pointermove") {
                System.setCursor("initial");
            }
            if (editorLayer) {
                editorLayer.onEvent(new SystemEvent(type));
            }
        };

        const onPointerDown = (ev: PointerEvent) => {
            stop(ev);
            sendToEditorLayer("pointerdown");
            viewportPressedMouseButtons.add(ev.button);
            Input.pressedMouseButtons.delete(ev.button);
            Input.updateInputAxes();
            this.canvas.focus({ preventScroll: true });
            if ((ev.button === 1 || ev.button === 2) && document.pointerLockElement !== this.canvas) {
                this.canvas.requestPointerLock();
            }
        };

        const onPointerUp = (ev: PointerEvent) => {
            stop(ev);
            sendToEditorLayer("pointerup");
            viewportPressedMouseButtons.delete(ev.button);
            Input.pressedMouseButtons.delete(ev.button);
            Input.updateInputAxes();
            if ((ev.button === 1 || ev.button === 2) && document.pointerLockElement === this.canvas) {
                document.exitPointerLock();
            }
        };

        const onMouseUp = (ev: MouseEvent) => {
            stop(ev);
            onPointerUp(ev as PointerEvent);
        };

        const onPointerMove = (ev: PointerEvent) => {
            stop(ev);
            sendToEditorLayer("pointermove");
            // Accumulate movement for viewport navigation and clear from shared Input
            viewportFrameMovement.x += ev.movementX * System.dpr;
            viewportFrameMovement.y += ev.movementY * System.dpr;
            Input.frameMovementPixels.set(0, 0);
        };

        const onKeyDown = (ev: KeyboardEvent) => {
            stop(ev);
            viewportPressedKeys.add(ev.code);
            Input.pressedKeys.delete(ev.code);
            Input.updateInputAxes();
        };

        const onKeyUp = (ev: KeyboardEvent) => {
            stop(ev);
            viewportPressedKeys.delete(ev.code);
            Input.pressedKeys.delete(ev.code);
            Input.updateInputAxes();
        };

        const onWheel = (ev: WheelEvent) => {
            ev.preventDefault();
            stop(ev);
        };

        const onContextMenu = (ev: MouseEvent) => {
            ev.preventDefault();
            stop(ev);
        };

        this.canvas.addEventListener("pointerdown", onPointerDown);
        this.canvas.addEventListener("pointerup", onPointerUp);
        // Fallback: mouseup fires reliably during pointer lock
        this.canvas.addEventListener("mouseup", onMouseUp);
        this.canvas.addEventListener("pointermove", onPointerMove);
        this.canvas.addEventListener("keydown", onKeyDown);
        this.canvas.addEventListener("keyup", onKeyUp);
        this.canvas.addEventListener("wheel", onWheel, { passive: false });
        this.canvas.addEventListener("contextmenu", onContextMenu);

        this.registerCleanup(() => {
            Input.setTargetElement(null);
            if (document.pointerLockElement === this.canvas) {
                document.exitPointerLock();
            }
            this.canvas.removeEventListener("pointerdown", onPointerDown);
            this.canvas.removeEventListener("pointerup", onPointerUp);
            this.canvas.removeEventListener("mouseup", onMouseUp);
            this.canvas.removeEventListener("pointermove", onPointerMove);
            this.canvas.removeEventListener("keydown", onKeyDown);
            this.canvas.removeEventListener("keyup", onKeyUp);
            this.canvas.removeEventListener("wheel", onWheel);
            this.canvas.removeEventListener("contextmenu", onContextMenu);
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

        const allLayers = world.getLayers();
        const editorLayer = allLayers.find(l => l instanceof EditorLayer) as EditorLayer | undefined;

        // Update viewport navigation
        editorLayer?.updateViewportNavigation(System.deltaTime);

        // Fill canvas with the first game camera's background color (the editor camera is transparent)
        const gameCamera = ViewportWindow.findFirstEnabledCamera(
            allLayers.filter(l => !(l instanceof EditorLayer))
        );
        if (gameCamera) {
            this.renderer.fillColor = gameCamera.backgroundColor;
            this.renderer.fillCanvas();
            this.renderer.resetTransform();
        }

        // Render every layer from the viewport camera's perspective
        const viewportCamera = editorLayer?.viewportCamera;
        if (viewportCamera) {
            viewportCamera.renderLayers(this.ctx, this.renderer, [...allLayers]);
        }

        // Reset frame movement after navigation consumed it
        Input.resetFrameMovement();
        viewportFrameMovement.set(0, 0);
    }
}
