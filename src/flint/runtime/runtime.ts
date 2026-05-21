import Input from "../shared/input";
import { System } from "./system";
import { ProjectLoader, type RawProjectData } from "./project-loader";
import { Renderer2D } from "../shared/renderer2d";
import type Component from "./component";
import Metadata from "../shared/metadata";
import type { World } from "./world";
import Camera from "./components/camera";

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

    private createRenderSurface(): void {
        const canvas = document.createElement("canvas");
        canvas.style.position = "fixed";
        canvas.style.left = "0";
        canvas.style.top = "0";
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        document.body.appendChild(canvas);
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

            if (width === 0 || height === 0) return;

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

            ctx.save();
            ctx.resetTransform();
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.restore();

            const world = System.world;
            if (world) {
                const allLayers = world.getLayers();
                // Find the first enabled camera in any layer
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


    public async start() {
        this.registerComponents();
        await this.loadProject();

        System.run();
    }

    private registerComponents() {
        for (const [name, value] of Object.entries(this.options.components)) {
            System.registerComponent(name, value);
        }
    }

    private async loadProject() {
        const data = ProjectLoader.deserialize(this.options.projectData);
        await ProjectLoader.load(data);
    }
}