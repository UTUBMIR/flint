import type { RawProjectData, AssetMeta } from "./project-data";

export type AssetTypeName = "custom" | "image" | "audio" | "json";

export const assetTypeNames: AssetTypeName[] = ["image", "audio", "json", "custom"];

export function assetTypeToNumber(name: AssetTypeName): number {
    switch (name) {
        case "custom":
            return -1;
        case "image":
            return 0;
        case "audio":
            return 1;
        case "json":
            return 2;
    }
}

export function assetTypeFromNumber(type: number): AssetTypeName {
    switch (type) {
        case -1:
            return "custom";
        case 0:
            return "image";
        case 1:
            return "audio";
        case 2:
            return "json";
        default:
            return "custom";
    }
}

export function listAssets(project: RawProjectData): AssetMeta[] {
    return project.assets;
}

export function addAsset(
    project: RawProjectData,
    input: { url: string; type: AssetTypeName; preload: boolean }
): AssetMeta {
    const asset: AssetMeta = {
        id: crypto.randomUUID(),
        url: input.url,
        type: assetTypeToNumber(input.type),
        preload: input.preload
    };

    project.assets.push(asset);
    return asset;
}

function findAssetIndex(project: RawProjectData, selector: string): number {
    return project.assets.findIndex(asset => asset.id === selector || asset.url === selector);
}

export function removeAsset(project: RawProjectData, selector: string): AssetMeta | undefined {
    const index = findAssetIndex(project, selector);
    if (index === -1) return undefined;

    const [removed] = project.assets.splice(index, 1);
    return removed;
}

export function renameAsset(project: RawProjectData, selector: string, newUrl: string): AssetMeta | undefined {
    const index = findAssetIndex(project, selector);
    if (index === -1) return undefined;

    project.assets[index]!.url = newUrl;
    return project.assets[index];
}
