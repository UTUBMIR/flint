import Layer from "./layer";
import { type UUID } from "./system";
export type RawProjectData = {
    layers: {
        objects: {
            uuid: UUID;
            components: {
                name: string;
                data: any;
            }[];
        }[];
    }[];
};
export type ProjectData = {
    layers: Layer[];
};
export declare class ProjectLoader {
    private constructor();
    static deserialize(data: string): ProjectData;
    static serialize(data: ProjectData): string;
    static load(project: ProjectData): void;
}
