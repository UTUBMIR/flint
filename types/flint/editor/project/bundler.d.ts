export default class Bundler {
    static files: Map<string, string>;
    static flintFiles: Map<string, string>;
    private static esbuild;
    private static readonly virtualFsPlugin;
    private constructor();
    static init(): Promise<typeof Bundler>;
    static bundle(entryPoint?: string): Promise<import("esbuild-wasm").BuildResult<{
        entryPoints: string[];
        bundle: true;
        write: false;
        format: "esm";
        target: string[];
        plugins: {
            name: string;
            setup(build: any): void;
        }[];
        external: string[];
        minify: true;
        keepNames: true;
        tsconfigRaw: string;
    }>>;
}
