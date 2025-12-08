export default class ModuleLoader {
    private constructor();
    static createTempURL(code: string, type?: string): string;
    static deleteTempUrl(url: string): void;
    static load(module: string): Promise<any>;
}
