/* eslint-disable @typescript-eslint/no-explicit-any */

export type UUID = `${string}-${string}-${string}-${string}-${string}`;

export type AssetMeta = {
    id: UUID;
    type: number;
    url: string;
    preload: boolean;
};

export type RawProjectData = {
    layers: {
        id: UUID;
        objects: {
            id: UUID;
            components: { name: string; data: any }[];
        }[];
    }[];
    assets: AssetMeta[];
};

export type BuildConfig = {
    components: { name: string; file: string }[];
    usePhysics: boolean;
    physicsPixelsPerMeter: number;
    physicsGravityX: number;
    physicsGravityY: number;
    generateJsMap: boolean;
};

export const defaultBuildConfig: BuildConfig = {
    components: [],
    usePhysics: true,
    physicsPixelsPerMeter: 100,
    physicsGravityX: 0,
    physicsGravityY: 9.8,
    generateJsMap: false
};

export function getUsedComponents(project: RawProjectData): string[] {
    const usedComponents = new Set<string>();

    for (const layer of project.layers) {
        for (const go of layer.objects) {
            for (const component of go.components) {
                usedComponents.add(component.name);
            }
        }
    }

    return [...usedComponents];
}
