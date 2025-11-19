/* eslint-disable @typescript-eslint/no-explicit-any */



export default class Builder {
    public static files = new Map<string, string>();

    private static esbuild: typeof import("esbuild-wasm");
    private static readonly virtualFsPlugin = {
        name: "virtual-fs",
        setup(build: any) {
            build.onResolve({ filter: /.*/ }, (args: any) => {
                // Resolve to normalized path without leading slash
                const resolved = new URL(args.path, "file://" + args.resolveDir + "/").pathname;
                const normalized = resolved.replace(/^\/+/, ""); // strip leading slash

                return {
                    path: normalized,
                    namespace: "virtual"
                };
            });

            build.onLoad({ filter: /.*/, namespace: "virtual" }, (args: any) => {
                const normalizedPath = args.path;

                const content = Builder.files.get(normalizedPath);
                if (!content) {
                    console.warn("Missing virtual file:", normalizedPath);
                    return { contents: "export {}", loader: "ts" };
                }

                return {
                    contents: content,
                    loader: "ts"
                };
            });
        }
    };



    private constructor() { }

    public static async init() {
        if (!Builder.esbuild) {
            const { default: esbuild } = await import("https://esm.sh/esbuild-wasm@0.19.12");
            await esbuild.initialize({
                wasmURL: "https://esm.sh/esbuild-wasm@0.19.12/esbuild.wasm",
            });
            Builder.esbuild = esbuild;
        }
        return Builder;
    }

    public static async build() {
        return await Builder.esbuild.build({
            entryPoints: ["/index.ts"],
            bundle: true,
            write: false,
            format: "esm",
            target: ["esnext"],
            plugins: [Builder.virtualFsPlugin],
        });
    }
}