import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { transformSource } from "@flint/build";

const require = createRequire(import.meta.url);
const cliDir = path.dirname(fileURLToPath(import.meta.url));

export type VirtualFileSystem = {
    files: Map<string, string>;
    flintFiles: Map<string, string>;
};

export type VirtualFsOptions = {
    stripEditorDecorators: boolean;
    moduleSearchPaths?: string[];
};

export function createVirtualFsPlugin(fs: VirtualFileSystem, stripEditorDecorators: boolean, options: { moduleSearchPaths?: string[] } = {}) {
    return {
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
                const virtualPath = normalized.startsWith(".") ? normalized.slice(2, normalized.length) : normalized;

                const flintPath = virtualPath.startsWith("@flint/") ? "flint/" + virtualPath.slice("@flint/".length) : undefined;

                if (fs.files.has(virtualPath)
                    || fs.flintFiles.has(virtualPath)
                    || (flintPath && (fs.flintFiles.has(flintPath) || fs.flintFiles.has(flintPath.replace(".ts", ".js"))))) {
                    return {
                        path: virtualPath,
                        namespace: "virtual",
                    };
                }

                // Bare npm module import that is not in the virtual file system:
                // resolve it from the project's (or the CLI's) node_modules.
                if (!args.path.startsWith(".") && !args.path.startsWith("/")) {
                    try {
                        const resolved = require.resolve(args.path, {
                            paths: [...(options.moduleSearchPaths ?? []), cliDir]
                        });
                        return {
                            path: resolved,
                            namespace: "file"
                        };
                    } catch {
                        // fall through to let esbuild report the error
                        return undefined;
                    }
                }

                return undefined;
            });


            build.onLoad({ filter: /.*/, namespace: "virtual" }, async (args: { path: string }) => {
                function run() {

                    if (args.path.startsWith("@flint")) {
                        let flintPath = "flint/" + args.path.replace("@flint/", "");
                        let content = fs.flintFiles.get(flintPath);
                        if (!content) {
                            flintPath = flintPath.replace(".ts", ".js");
                            content = fs.flintFiles.get(flintPath);
                        }

                        if (!content) {
                            console.warn("Missing virtual flint file:", flintPath);

                            return { contents: "export {}", loader: flintPath.endsWith(".json") ? "json" : "ts" };
                        }

                        return {
                            contents: transformSource(content, flintPath, stripEditorDecorators),
                            loader: flintPath.endsWith(".ts") ? "ts" : flintPath.endsWith(".js") ? "js" : "json"
                        };
                    }

                    const normalizedPath = args.path;

                    const content = fs.files.get(normalizedPath);
                    if (!content) {
                        const content =
                            fs.flintFiles.get(normalizedPath) ??
                            fs.flintFiles.get(normalizedPath.replace(".ts", ".js"));
                        if (content) {
                            return {
                                contents: transformSource(content, normalizedPath, stripEditorDecorators),
                                loader: normalizedPath.endsWith(".ts") ? "ts" : normalizedPath.endsWith(".js") ? "js" : "json"
                            };
                        }

                        console.warn("Missing virtual file:", normalizedPath);
                        return { contents: "export {}", loader: "ts" };
                    }

                    return {
                        contents: transformSource(content, normalizedPath, stripEditorDecorators, true),
                        loader: normalizedPath.endsWith(".ts") ? "ts" : "json"
                    };
                }
                const result = run();
                return result;
            });
        }
    };
}
