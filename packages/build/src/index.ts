export {
    generateMain,
    makeFullIndex,
    makeUserIndex,
    type BuildMode
} from "./generate-main";
export {
    transformSource,
    editorDecoratorPattern
} from "./strip-decorators";
export { makeHtml } from "./make-html";
export {
    getUsedComponents,
    defaultBuildConfig,
    type BuildConfig,
    type RawProjectData,
    type AssetMeta,
    type UUID
} from "./project-data";
export { CasingHandler } from "./casing-handler";
export { makeComponentSource, componentFileName } from "./component-template";
export {
    defaultProjectData,
    minimalProjectData,
    defaultProjectFiles,
    defaultProjectComponents,
    defaultProjectConfig,
    defaultTsConfig,
    type ProjectTemplateFile,
    type ProjectTemplateComponent
} from "./project-templates";
export {
    assetTypeNames,
    assetTypeToNumber,
    assetTypeFromNumber,
    listAssets,
    addAsset,
    removeAsset,
    renameAsset,
    type AssetTypeName
} from "./project-assets";
