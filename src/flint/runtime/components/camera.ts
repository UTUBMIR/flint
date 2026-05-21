import { FieldInspector } from "@flint/shared/metadata";
import type { ColorString } from "../../shared/graphics";
import Vector2 from "../../shared/vector2";
import RendererComponent from "../renderer-component";
import type { IRenderer } from "../../shared/irenderer";
import type { PhysicsWorld } from "../physics-world";
import type Layer from "../layer";
import { System } from "../system";

export default class Camera extends RendererComponent {
    private static _main: Camera | null = null;

    /**
     * The designated main camera.
     *
     * - If explicitly assigned via `Camera.main = camera`, returns that camera.
     * - Otherwise, auto-finds the first enabled camera with `isMainCamera = true`.
     * - Returns `null` if no suitable camera exists.
     */
    public static get main(): Camera | null {
        if (Camera._main?.enabled && Camera._main.gameObject) {
            return Camera._main;
        }
        Camera._main = null;

        const world = System.world;
        if (world) {
            for (const layer of world.getLayers()) {
                for (const obj of layer.getObjects()) {
                    const cam = obj.getComponent(Camera);
                    if (cam?.enabled && cam.isMainCamera) {
                        Camera._main = cam;
                        return cam;
                    }
                }
            }
        }
        return null;
    }

    public static set main(value: Camera | null) {
        Camera._main = value;
    }

    public enabled: boolean = true;

    /** Designate this camera as the main camera accessible via `Camera.main`. Set this to `true` on your game camera. */
    @FieldInspector("boolean")
    public isMainCamera: boolean = false;

    /**
     * Converts a screen-space position (in world/physics units, relative to the screen center)
     * into a world-space position (in world/physics units) using the given camera transform.
     */
    public screenPhysicsToWorld(screenPosition: Vector2) {
        return Camera.screenPhysicsToWorldAt(screenPosition, this.position, this.angle);
    }

    public static screenPhysicsToWorldAt(screenPosition: Vector2, cameraPosition: Vector2, cameraAngle: number): Vector2 {
        const cos = Math.cos(cameraAngle);
        const sin = Math.sin(cameraAngle);

        const rotated = new Vector2(
            screenPosition.x * cos - screenPosition.y * sin,
            screenPosition.x * sin + screenPosition.y * cos
        );

        return cameraPosition.copy().add(rotated);
    }

    public constructor(backgroundColor?: ColorString) {
        super();
        this.backgroundColor = backgroundColor ?? "#222" as ColorString;
    }

    @FieldInspector("color")
    public backgroundColor: ColorString;

    public get position(): Vector2 {
        return this.transform.position;
    }

    public get angle(): number {
        return this.transform.rotation;
    }

    public override attach(): void {
        // Camera orchestrates rendering; it does not register as a visual component
        if (this.isMainCamera) {
            Camera.main = this;
        }
    }

    public override detach(): void {
        if (Camera._main === this) {
            Camera._main = null;
        }
    }

    public renderLayers(ctx: CanvasRenderingContext2D, renderer: IRenderer, layers: Layer[]): void {
        if (!this.enabled) return;

        const canvasHalf = new Vector2(ctx.canvas.width, ctx.canvas.height).divide(2).round();

        const world = System.world as Partial<PhysicsWorld>;
        const toPixels = typeof world.toPixels === "function"
            ? world.toPixels.bind(world)
            : (value: number) => value;
        const cameraPos = this.position.copy().set(
            toPixels(this.position.x),
            toPixels(this.position.y)
        );

        renderer.fillColor = this.backgroundColor;
        renderer.fillCanvas();
        renderer.resetTransform();

        renderer.translate(canvasHalf);
        renderer.rotate(-this.angle);
        renderer.translate(Vector2.zero.subtract(cameraPos));

        // Render from bottom (highest index) to top (lowest index) — matches World.render() order
        for (let i = layers.length - 1; i >= 0; i--) {
            const layer = layers[i]!;
            layer.renderSystem.currentCamera = this;
            layer.renderSystem.render(renderer);
        }
    }
}
