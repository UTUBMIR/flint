import { Project } from "./project";

type ConfigType = {
    components: {name: string, file: string}[]
    rootPath?: string
}

export default class ProjectConfig {
    public static readonly configFileName = "project-config.json";
    public static config: ConfigType;
    private static readonly index = `export * from "@flint/runtime/system";export { default as Input } from "@flint/shared/input";export { default as Metadata } from "@flint/shared/metadata";`;

    public static get fullIndex(): string {
        return ProjectConfig.index + ProjectConfig.config.components.map(c => `export * from "./${c.file}";`).join("");
    }

    public static get userIndex(): string {
        return ProjectConfig.config.components.map(c => `export * from "./${c.file}";`).join("");
    }

    public static tsConfig = `{
    "compilerOptions": {
        "baseUrl": ".",
        "paths": {
            "@flint/*": [
                "flint/*"
            ]
        },
        "experimentalDecorators": true,
        "emitDecoratorMetadata": true,
    }
}`;

    private static defaultConfig: ConfigType = {
        components: []
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

            const tsFileHandle = await Project.folderHandle.getFileHandle("tsconfig.json");
            const tsFile = await tsFileHandle.getFile();
            ProjectConfig.tsConfig = await tsFile.text();

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

        const tsFileHandle = await Project.folderHandle.getFileHandle("tsconfig.json", { create: true });
        const tsWritable = await tsFileHandle.createWritable();
        await tsWritable.write(ProjectConfig.tsConfig);
        await tsWritable.close();
    }

    public static async ensureLoaded() {
        const exists = await ProjectConfig.load();
        if (!exists) {
            await ProjectConfig.create();
            ProjectConfig.config = ProjectConfig.defaultConfig;
            return true;
        }
        return false;
    }
}