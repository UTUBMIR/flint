import { System } from "./system";
import { ProjectLoader, type RawProjectData } from "./project-loader";
import { Renderer2D } from "../shared/renderer2d";
import type Component from "./component";
import Metadata from "../shared/metadata";
import type { World } from "./world";

export class Runtime {
    public constructor(private options: {
        components: Record<string, typeof Component>;
        projectData: RawProjectData;
        enableMetadata: boolean;
        world: World
    }) {
        Metadata.enabled = options.enableMetadata;
        
        System.init({
            renderer: new Renderer2D(),
            world: this.options.world
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