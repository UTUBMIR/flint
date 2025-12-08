type ConfigType = {
    components: {
        name: string;
        file: string;
    }[];
    rootPath?: string;
};
export default class ProjectConfig {
    static readonly configFileName = "project-config.json";
    static config: ConfigType;
    private static readonly index;
    static get fullIndex(): string;
    static get userIndex(): string;
    static tsConfig: string;
    private static defaultConfig;
    static save(): Promise<void>;
    static load(): Promise<boolean>;
    static create(): Promise<void>;
    static ensureLoaded(): Promise<boolean>;
}
export {};
