import Input from "@flint/shared/input";
import { System } from "./system";
import { ProjectLoader, type RawProjectData } from "./project-loader";
import { Renderer2D } from "@flint/shared/renderer2d";
import type Component from "./component";
import Metadata from "@flint/shared/metadata";
import type { World } from "./world";
import Camera from "./components/camera";
/**
 * Main entry point for running a game project.
 * Owns the render surface, wires up the ECS world, and drives the game loop.
 */
export class Runtime {
    public constructor(private options: {
        components: Record<string, typeof Component>;
        projectData: RawProjectData;
        enableMetadata: boolean;
        world: World
    }) {
        Metadata.enabled = options.enableMetadata;

        System.init({
            world: this.options.world
        });

        this.createRenderSurface();
    }

    /**
     * Creates a full-screen canvas.
     * Registers its render callback with the System.
     * Called every frame so the canvas fills the viewport.
     * The active camera drives what gets drawn.
     */
    private createRenderSurface(): void {
        const rootDiv = document.getElementById("root")!;
        System.setRootElement(rootDiv);

        const canvas = document.createElement("canvas");
        canvas.style.position = "fixed";
        canvas.style.left = "0";
        canvas.style.top = "0";
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        rootDiv.appendChild(canvas);
        Input.setTargetElement(canvas);

        const ctx = canvas.getContext("2d");
        if (!ctx) {
            throw new Error("Failed to get 2D context");
        }

        const renderer = new Renderer2D();
        let lastWidth = 0;
        let lastHeight = 0;

        System.addRenderTarget(() => {
            const dpr = System.dpr;
            const width = window.innerWidth;
            const height = window.innerHeight;

            // Skip frames when the window is minimized.
            if (width === 0 || height === 0) return;

            // Resize canvas backing store to match display size × DPR for HiDPI. Re-allocate only on change to avoid churn.
            if (width !== lastWidth || height !== lastHeight) {
                lastWidth = width;
                lastHeight = height;
                canvas.width = Math.floor(width * dpr);
                canvas.height = Math.floor(height * dpr);
                canvas.style.width = width + "px";
                canvas.style.height = height + "px";
            }

            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.scale(dpr, dpr);

            renderer.setCanvas(canvas, ctx);

            // Clear all physical pixels before drawing the next frame (reset transform covers the full backing store).
            ctx.save();
            ctx.resetTransform();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.restore();

            const world = System.world;
            if (world) {
                const allLayers = world.getLayers();
                // Only one active camera drives the view. Scan layers breadth-first for the first enabled one.
                let gameCamera: Camera | undefined;
                for (const layer of allLayers) {
                    for (const obj of layer.getObjects()) {
                        const cam = obj.getComponent(Camera);
                        if (cam && cam.enabled) {
                            gameCamera = cam;
                            break;
                        }
                    }
                    if (gameCamera) break;
                }
                if (gameCamera) {
                    gameCamera.renderLayers(ctx, renderer, [...allLayers]);
                }
            }
        });
    }


    /**
     * After construction the caller must call start().
     * Two-phase setup lets the caller attach listeners
     * between surface creation and the first frame.
     */
    public async start() {
        this.registerComponents();
        await this.loadProject();

        System.run();
    }

    /**
     * Register component types by name.
     * Lets the loader look them up during deserialisation.
     */
    private registerComponents() {
        for (const [name, value] of Object.entries(this.options.components)) {
            System.registerComponent(name, value);
        }
    }

    /**
     * Deserialise and load project data in two steps.
     * The first pass may produce cross-references,
     * like asset references needing a second pass.
     */
    private async loadProject() {
        const data = ProjectLoader.deserialize(this.options.projectData);
        await ProjectLoader.load(data);
    }
}
