export type AssetData = {
    id: string;
    name: string;
    type: "folder" | "component" | "json" | "file";
    path: string;
    data: string;
};
