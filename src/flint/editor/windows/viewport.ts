import Input from "@flint/shared/input";
import { Renderer2D } from "@flint/shared/renderer2d";
import type { IRenderer } from "@flint/shared/irenderer";
import { System } from "@flint/runtime/system";
import { SystemEvent } from "@flint/runtime/system-event";
import { World } from "@flint/runtime/world";
import { BaseEditorWindow, type EditorWindowControl, type WindowContext } from "../window-framework";
import { EditorLayer, ViewportNavigation } from "../editor-layer";
import Camera from "@flint/runtime/components/camera";
import GameObject from "@flint/runtime/game-object";
import Vector2 from "@flint/shared/vector2";
import type Layer from "@flint/runtime/layer";

export default class ViewportWindow extends BaseEditorWindow {
    private readonly canvas: HTMLCanvasElement;
    private readonly ctx: CanvasRenderingContext2D;
    private readonly renderer: IRenderer;
    private readonly renderCallback: () => void;
    private readonly camera: Camera;
    private readonly navigation: ViewportNavigation;
    private locked = false;
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
        this.camera = new Camera("rgba(0, 0, 0, 0)");
        this.navigation = new ViewportNavigation();
        new GameObject([this.camera]); // wrap in GameObject for transform

        this.renderCallback = this.onRender.bind(this);
    }

    public override getControls(): readonly EditorWindowControl[] {
        return [{
            id: "viewport-lock",
            icon: this.locked ? "lock-fill" : "unlock-fill",
            title: this.locked
                ? "Unlock viewport to follow selection"
                : "Lock viewport to current camera position",
            ariaLabel: this.locked ? "Unlock viewport" : "Lock viewport",
            active: this.locked,
            onClick: () => {
                this.locked = !this.locked;
                if (this.locked) {
                    EditorLayer.lockedCameras.add(this.camera);
                } else {
                    EditorLayer.lockedCameras.delete(this.camera);
                }
                this.refreshControls();
            }
        }];
    }

    public override initialize(): void {
        System.addRenderTarget(this.renderCallback);
        Input.setTargetElement(this.canvas);

        this.canvas.tabIndex = -1;
        this.canvas.style.outline = "none";

        const stop = (ev: Event) => ev.stopPropagation();

        // Only consume pointer events that started with a press on this canvas.
        // Events that pass over the canvas during an external drag (e.g. window tab)
        // are let through so the drag system does not freeze.
        const ownedPointers = new Set<number>();

        const updateInputPosition = (ev: PointerEvent) => {
            if (document.pointerLockElement === this.canvas) return;
            const rect = this.canvas.getBoundingClientRect();
            const canvasHalf = new Vector2(rect.width, rect.height).divide(2).round();
            Input.mousePositionPixels.set(ev.clientX - rect.left, ev.clientY - rect.top)
                .subtract(canvasHalf)
                .multiply(System.dpr);

            const ppm = typeof (System.world as Partial<{ pixelsPerMeter: number }>).pixelsPerMeter === "number"
                ? (System.world as { pixelsPerMeter: number }).pixelsPerMeter
                : 1;
            Input.mousePosition.set(
                World.toPhysicsUnits(Input.mousePositionPixels.x, ppm),
                World.toPhysicsUnits(Input.mousePositionPixels.y, ppm)
            );
        };

        const sendToEditorLayer = (type: string) => {
            if (type === "pointermove") {
                System.setCursor("initial");
            }
            const layer = System.world?.getLayers().find(l => l instanceof EditorLayer) as EditorLayer | undefined;
            if (layer) {
                EditorLayer.activeViewportCamera = this.camera;
                layer.onEvent(new SystemEvent(type));
            }
        };

        const onPointerDown = (ev: PointerEvent) => {
            ownedPointers.add(ev.pointerId);
            stop(ev);
            updateInputPosition(ev);
            sendToEditorLayer("pointerdown");
            this.navigation.pressedMouseButtons.add(ev.button);
            Input.pressedMouseButtons.delete(ev.button);
            Input.updateInputAxes();
            this.canvas.focus({ preventScroll: true });
            if ((ev.button === 1 || ev.button === 2) && document.pointerLockElement !== this.canvas) {
                this.canvas.requestPointerLock();
            }
        };

        const onPointerUp = (ev: PointerEvent) => {
            const owned = ownedPointers.has(ev.pointerId);
            ownedPointers.delete(ev.pointerId);
            if (!owned && document.pointerLockElement !== this.canvas) return;
            stop(ev);
            updateInputPosition(ev);
            sendToEditorLayer("pointerup");
            this.navigation.pressedMouseButtons.delete(ev.button);
            Input.pressedMouseButtons.delete(ev.button);
            Input.updateInputAxes();
            if ((ev.button === 1 || ev.button === 2) && document.pointerLockElement === this.canvas) {
                document.exitPointerLock();
            }
        };

        const onMouseUp = (ev: MouseEvent) => {
            if (!ownedPointers.has((ev as PointerEvent).pointerId) && document.pointerLockElement !== this.canvas) return;
            stop(ev);
            onPointerUp(ev as PointerEvent);
        };

        const onPointerMove = (ev: PointerEvent) => {
            const owned = ownedPointers.has(ev.pointerId);
            updateInputPosition(ev);
            sendToEditorLayer("pointermove");
            if (!owned) return;
            stop(ev);
            // Accumulate movement for this viewport's navigation and clear from shared Input
            this.navigation.frameMovement.x += ev.movementX * System.dpr;
            this.navigation.frameMovement.y += ev.movementY * System.dpr;
            Input.frameMovementPixels.set(0, 0);
        };

        const onKeyDown = (ev: KeyboardEvent) => {
            if (document.activeElement !== this.canvas && document.pointerLockElement !== this.canvas) return;
            stop(ev);
            this.navigation.pressedKeys.add(ev.code);
            Input.pressedKeys.delete(ev.code);
            Input.updateInputAxes();
        };

        const onKeyUp = (ev: KeyboardEvent) => {
            if (document.activeElement !== this.canvas && document.pointerLockElement !== this.canvas) return;
            stop(ev);
            this.navigation.pressedKeys.delete(ev.code);
            Input.pressedKeys.delete(ev.code);
            Input.updateInputAxes();
        };

        const onWheel = (ev: WheelEvent) => {
            if (document.activeElement !== this.canvas && document.pointerLockElement !== this.canvas) return;
            ev.preventDefault();
            stop(ev);
            this.navigation.applyZoomDelta(ev.deltaY);
        };

        const onContextMenu = (ev: MouseEvent) => {
            if (!ownedPointers.has((ev as PointerEvent).pointerId)) return;
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
            EditorLayer.lockedCameras.delete(this.camera);
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

        // Update this viewport's navigation and set it as the active editor camera
        EditorLayer.activeViewportCamera = this.camera;
        if (this.camera.enabled) {
            const ppm = typeof (world as Partial<{ pixelsPerMeter: number }>).pixelsPerMeter === "number"
                && (world as { pixelsPerMeter: number }).pixelsPerMeter > 0
                ? (world as { pixelsPerMeter: number }).pixelsPerMeter
                : 1;
            this.navigation.update(this.camera, System.deltaTime, ppm);
        }

        // Fill canvas with the first game camera's background color (the editor camera is transparent)
        const gameCamera = ViewportWindow.findFirstEnabledCamera(
            allLayers.filter(l => !(l instanceof EditorLayer))
        );
        if (gameCamera) {
            this.renderer.fillColor = gameCamera.backgroundColor;
            this.renderer.fillCanvas();
            this.renderer.resetTransform();
        }

        // Sync gizmo drag positions with the updated camera so the dragged object
        // follows the camera in the same frame instead of lagging one frame behind.
        editorLayer?.updateDragGizmos();

        // Render every layer from this viewport's camera perspective
        this.camera.renderLayers(this.ctx, this.renderer, [...allLayers]);

        // Reset frame movement after navigation consumed it
        Input.resetFrameMovement();
        this.navigation.frameMovement.set(0, 0);
    }
}
