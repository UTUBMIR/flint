import { Project } from "./project";

type ConfigType = {
    index: string,
    rootPath?: string
}

export default class ProjectConfig {
    public static readonly configFileName = "project-config.json";
    public static config: ConfigType;
    private static defaultConfig: ConfigType = {
        index: `export * from "./flint/runtime/system";export { default as Input } from "./flint/shared/input";export { default as Metadata } from "./flint/shared/metadata";`
    };

    public static async save() {
        const fileHandle = await Project.folderHandle.getFileHandle(ProjectConfig.configFileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(ProjectConfig.config, null, 4));
        await writable.close();
    }

    public static async load() {
        try {
            const fileHandle = await Project.folderHandle.getFileHandle(ProjectConfig.configFileName);
            const file = await fileHandle.getFile();
            const content = await file.text();
            this.config = JSON.parse(content);
            return true;
        } catch {
            return false;
        }
    }

    public static async create() {
        const fileHandle = await Project.folderHandle.getFileHandle(ProjectConfig.configFileName, { create: true });
        const writable = await fileHandle.createWritable();
        await writable.write(JSON.stringify(ProjectConfig.defaultConfig, null, 4));
        await writable.close();
    }

    public static async ensureLoaded() {
        const exists = await ProjectConfig.load();
        if (!exists) {
            await ProjectConfig.create();
            ProjectConfig.config = ProjectConfig.defaultConfig;
        }
    }
}