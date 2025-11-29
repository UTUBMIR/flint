/* eslint-disable @typescript-eslint/no-explicit-any */



export default class Builder {
    public static files = new Map<string, string>();

    private static esbuild: typeof import("esbuild-wasm");
    private static readonly virtualFsPlugin = {
        name: "virtual-fs",
        setup(build: any) {
            build.onResolve({ filter: /.*/ }, (args: { path: string; resolveDir: string; importer: string }) => {
                // Ensure the import has .ts or .json extension
                const importPath = args.path.endsWith(".ts") || args.path.endsWith(".json") ? args.path : args.path + ".ts";

                // Get the base directory
                let baseDir = args.importer ? args.importer.replace(/\/[^/]*$/, "") : args.resolveDir;

                // Normalize slashes
                baseDir = baseDir.replace(/\\/g, "/");

                // Split paths into segments
                const baseSegments = baseDir.split("/").filter(Boolean);
                const importSegments = importPath.split("/").filter(Boolean);

                const resolvedSegments: string[] = [];

                // If import path starts with ".", we resolve relative
                if (!baseDir.includes(".") && (importPath.startsWith("./") || importPath.startsWith("../"))) {
                    resolvedSegments.push(...baseSegments);

                    for (const seg of importSegments) {
                        if (seg === ".") continue; // current directory
                        if (seg === "..") resolvedSegments.pop(); // go up
                        else resolvedSegments.push(seg); // normal segment
                    }
                } else {
                    // For non-relative paths, just use as-is
                    resolvedSegments.push(...importSegments);
                }

                // Join and normalize
                const normalized = resolvedSegments.join("/");

                // console.log("importPath:", importPath);
                // console.log("baseDir:", baseDir);
                // console.log("resolved:", normalized);

                return {
                    path: normalized.startsWith(".") ? normalized.slice(2, normalized.length) : normalized,
                    namespace: "virtual",
                };
            });


            build.onLoad({ filter: /.*/, namespace: "virtual" }, (args: { path: string }) => {
                const normalizedPath = args.path;

                const content = Builder.files.get(normalizedPath);
                if (!content) {
                    console.warn("Missing virtual file:", normalizedPath);
                    return { contents: "export {}", loader: "ts" };
                }

                return {
                    contents: content,
                    loader: normalizedPath.endsWith(".ts") ? "ts" : "json"
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
            external: ["flint/*"],
            minify: true,
            keepNames: true,
            tsconfigRaw: {
                compilerOptions: {
                    experimentalDecorators: true,
                    emitDecoratorMetadata: true,
                }
            }

        });
    }
}