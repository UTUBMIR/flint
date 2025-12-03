import ProjectConfig from "./project-config";

export default class Bundler {
    public static files = new Map<string, string>();
    public static flintFiles = new Map<string, string>();

    private static esbuild: typeof import("esbuild-wasm");
    private static readonly virtualFsPlugin = {
        name: "virtual-fs",
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setup(build: any) {
            build.onResolve({ filter: /.*/ }, (args: { path: string; resolveDir: string; importer: string }) => {
                // Ensure the import has .ts or .json extension
                const importPath = args.path.endsWith(".ts") || args.path.endsWith(".json") ? args.path : args.path + ".ts";

                if (importPath.startsWith("@flint")) {
                    return {
                        path: importPath,
                        namespace: "virtual",
                    };
                }

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
                if (args.path.startsWith("@flint")) {
                    const flintPath = "flint/" + args.path.replace("@flint/", "");
                    const content = Bundler.flintFiles.get(flintPath);

                    if (!content) {
                        console.warn("Missing virtual flint file:", flintPath);
                        
                        return { contents: "export {}", loader: flintPath.endsWith(".json") ? "json" : "ts" };
                    }

                    return {
                        contents: content,
                        loader: flintPath.endsWith(".ts") ? "ts" : "json"
                    };
                }

                const normalizedPath = args.path;

                const content = Bundler.files.get(normalizedPath);
                if (!content) {
                    const content = Bundler.flintFiles.get(normalizedPath);
                    if (content) {
                        return {
                            contents: content, loader: normalizedPath.endsWith(".ts") ? "ts" : "json"
                        };
                    }

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
        if (!Bundler.esbuild) {
            const { default: esbuild } = await import("https://esm.sh/esbuild-wasm@0.19.12");
            await esbuild.initialize({
                wasmURL: "https://esm.sh/esbuild-wasm@0.19.12/esbuild.wasm",
            });
            Bundler.esbuild = esbuild;
        }
        return Bundler;
    }

    public static async bundle() {
        return await Bundler.esbuild.build({
            entryPoints: ["/index.ts"],
            bundle: true,
            write: false,
            format: "esm",
            target: ["esnext"],
            plugins: [Bundler.virtualFsPlugin],
            external: ["flint/*"],
            minify: true,
            keepNames: true,
            tsconfigRaw: ProjectConfig.tsConfig
        });
    }
}