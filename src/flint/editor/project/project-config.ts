import { System } from "../../runtime/system";

type ConfigType = {
    components: { name: string, file: string }[]
    assets: { name: string, file: string }[]
    rootPath?: string,
    usePhysics: boolean
    physicsPixelsPerMeter: number
    physicsGravityX: number
    physicsGravityY: number
    generateJsMap: boolean
}

export default class ProjectConfig {
    public static readonly configFileName = "project-config.json";
    public static config: ConfigType;
    private static readonly index = `export * from "@flint/runtime/system";export { default as Input } from "@flint/shared/input";export { default as Metadata } from "@flint/shared/metadata";export * from "@flint/runtime/assets";export * from "@flint/runtime/timers";`;

    public static get fullIndex(): string {
        return ProjectConfig.index + ProjectConfig.config.components.map(c => `export {${c.name}} from "${c.file}";`).join("");
    }

    public static get userIndex(): string {
        return ProjectConfig.config.components.map(c => `export {${c.name}} from "${c.file}";`).join("");
    }

    public static tsConfig = `{
    "compilerOptions": {
        "baseUrl": ".",
        "paths": {
            "@flint/*": [
                "flint/*"
            ]
        },
        "noImplicitOverride": true,
        "module": "esnext",
        "target": "esnext",
        "experimentalDecorators": false,
        "useDefineForClassFields": false
    }
}`;

    private static defaultConfig: ConfigType = {
        components: [],
        assets: [],
        usePhysics: true,
        physicsPixelsPerMeter: 100,
        physicsGravityX: 0,
        physicsGravityY: 9.8,
        generateJsMap: false
    };

    public static async save() {
        await System.fileSystem.writeTextFile(ProjectConfig.configFileName, JSON.stringify(ProjectConfig.config, null, 4));
    }

    public static async load() {
        try {
            const content = await System.fileSystem.readTextFile(ProjectConfig.configFileName);

            const parsed = JSON.parse(content) as Partial<ConfigType>;
            this.config = {
                ...ProjectConfig.defaultConfig,
                ...parsed
            };

            ProjectConfig.tsConfig = await System.fileSystem.readTextFile("tsconfig.json");

            return true;
        } catch {
            return false;
        }
    }

    public static async create() {
        await System.fileSystem.writeTextFile(ProjectConfig.configFileName, JSON.stringify(ProjectConfig.defaultConfig, null, 4));
        await System.fileSystem.writeTextFile("tsconfig.json", ProjectConfig.tsConfig);
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
