import ProjectConfig from "./project-config";

declare const __FLINT_ESBUILD_MODULE_URL__: string;
declare const __FLINT_ESBUILD_WASM_URL__: string;
const dynamicImport = new Function("url", "return import(url);") as (url: string) => Promise<{ default: typeof import("esbuild-wasm") }>;

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


            build.onLoad({ filter: /.*/, namespace: "virtual" }, async (args: { path: string }) => {
                if (args.path.startsWith("@flint")) {
                    let flintPath = "flint/" + args.path.replace("@flint/", "");
                    let content = Bundler.flintFiles.get(flintPath);
                    if (!content) {
                        flintPath = flintPath.replace(".ts", ".js");
                        content = Bundler.flintFiles.get(flintPath);
                    }

                    if (!content) {
                        console.warn("Missing virtual flint file:", flintPath);

                        return { contents: "export {}", loader: flintPath.endsWith(".json") ? "json" : "ts" };
                    }

                    return {
                        contents: content,
                        loader: flintPath.endsWith(".ts") ? "ts" : flintPath.endsWith(".js") ? "js" : "json"
                    };
                }

                const normalizedPath = args.path;

                const content = Bundler.files.get(normalizedPath);
                if (!content) {
                    const content =
                        Bundler.flintFiles.get(normalizedPath) ??
                        Bundler.flintFiles.get(normalizedPath.replace(".ts", ".js"));
                    if (content) {
                        return {
                            contents: content, loader: normalizedPath.endsWith(".ts") ? "ts" : normalizedPath.endsWith(".js") ? "js" : "json"
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
            const { default: esbuild } = await dynamicImport(__FLINT_ESBUILD_MODULE_URL__);
            await esbuild.initialize({
                wasmURL: new URL(__FLINT_ESBUILD_WASM_URL__, window.location.href).toString(),
            });

            Bundler.esbuild = esbuild;
        }
        return Bundler;
    }


    public static async bundle(entryPoint: string = "/index.ts", sourceMap?: boolean) {
        return await Bundler.esbuild.build({
            entryPoints: [entryPoint],
            bundle: true,
            write: false,
            format: "esm",
            target: ["es2024"],
            plugins: [Bundler.virtualFsPlugin],
            external: ["@flint/"],
            platform: "browser",
            minify: true,
            keepNames: false,
            tsconfigRaw: ProjectConfig.tsConfig,
            treeShaking: true,
            ...(sourceMap ? {sourcemap: "inline"} : {})
        });
    }
}
