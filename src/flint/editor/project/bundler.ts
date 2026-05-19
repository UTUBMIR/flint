import ProjectConfig from "./project-config";

declare const __FLINT_ESBUILD_MODULE_URL__: string;
declare const __FLINT_ESBUILD_WASM_URL__: string;
const dynamicImport = new Function("url", "return import(url);") as (url: string) => Promise<{ default: typeof import("esbuild-wasm") }>;

export default class Bundler {
    public static files = new Map<string, string>();
    public static flintFiles = new Map<string, string>();

    private static esbuild: typeof import("esbuild-wasm");
    private static stripEditorDecorators = false;
    private static readonly editorDecoratorPattern =
        /^\s*@(HideInInspector|ShowInInspector|NonSerialized|FieldInspector|SelectInspector)(\s*\([^)]*\))?\s*$/gm;

    private static getInspectorMetadataImport(): string {
        if (this.stripEditorDecorators) {
            return 'import { SerializeType as __FlintSerializeType } from "@flint/shared/metadata";';
        }
        return 'import { FieldInspector as __FlintFieldInspector, SelectInspector as __FlintSelectInspector, SerializeType as __FlintSerializeType } from "@flint/shared/metadata";';
    }

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
                        contents: Bundler.transformSource(content, flintPath),
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
                            contents: Bundler.transformSource(content, normalizedPath),
                            loader: normalizedPath.endsWith(".ts") ? "ts" : normalizedPath.endsWith(".js") ? "js" : "json"
                        };
                    }

                    console.warn("Missing virtual file:", normalizedPath);
                    return { contents: "export {}", loader: "ts" };
                }

                return {
                    contents: Bundler.transformSource(content, normalizedPath, true),
                    loader: normalizedPath.endsWith(".ts") ? "ts" : "json"
                };
            });
        }
    };



    private constructor() { }

    private static transformSource(content: string, path: string, autoDetectInspectors = false): string {
        if (!path.endsWith(".ts")) {
            return content;
        }

        if (this.stripEditorDecorators) {
            const stripped = content.replace(this.editorDecoratorPattern, "");
            if (!autoDetectInspectors || path.endsWith(".d.ts")) {
                return stripped;
            }
            return this.addInferredSerializeTypeDecorators(stripped);
        }

        if (!autoDetectInspectors || path.endsWith(".d.ts")) {
            return content;
        }

        return this.addInferredInspectorDecorators(content);
    }

    private static addInferredInspectorDecorators(content: string): string {
        const lines = content.split(/\r?\n/);
        const output: string[] = [];
        let changed = false;
        let decorators: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith("@")) {
                output.push(line);
                decorators.push(trimmed);
                continue;
            }

            const field = line.match(/^(\s*)(?:(public|protected)\s+)?([A-Za-z_$][\w$]*)([!?])?\s*:\s*([^=;]+)([=;].*)?$/);
            if (field) {
                const hasExplicitInspectorMetadata = decorators.some(decorator =>
                    /^@(HideInInspector|NonSerialized|FieldInspector|SelectInspector|SerializeType)\b/.test(decorator)
                );

                if (!hasExplicitInspectorMetadata) {
                    const indent = field[1] ?? "";
                    const inferredDecorators: string[] = [];

                    const inspectorDecorator = this.inferInspectorDecorator(field[5] ?? "");
                    if (inspectorDecorator) {
                        inferredDecorators.push(inspectorDecorator);
                    }

                    const serializeTypeDecorator = this.inferSerializeTypeDecorator(field[5] ?? "");
                    if (serializeTypeDecorator) {
                        inferredDecorators.push(serializeTypeDecorator);
                    }

                    if (inferredDecorators.length > 0) {
                        for (const decorator of inferredDecorators) {
                            output.push(`${indent}${decorator}`);
                        }
                        changed = true;
                    }
                }

                output.push(line);
                decorators = [];
                continue;
            }

            output.push(line);

            if (trimmed.length > 0) {
                decorators = [];
            }
        }

        if (!changed) {
            return content;
        }

        return `${this.getInspectorMetadataImport()}\n${output.join("\n")}`;
    }

    private static inferInspectorDecorator(typeAnnotation: string): string | null {
        const parts = this.splitUnionType(typeAnnotation)
            .map(part => part.trim())
            .filter(part => part !== "undefined" && part !== "null");

        if (parts.length === 0) {
            return null;
        }

        const selectOptions = parts.map(part => {
            const match = part.match(/^"([^"]*)"$/);
            return match?.[1];
        });

        if (selectOptions.every((option): option is string => option !== undefined)) {
            return `@__FlintSelectInspector(${JSON.stringify(selectOptions)})`;
        }

        if (parts.length !== 1) {
            return null;
        }

        const typeName = parts[0]!.replace(/^readonly\s+/, "");
        if (/(^|\.)Component$/.test(typeName)) {
            return '@__FlintFieldInspector("component")';
        }

        if (/(^|\.)GameObject$/.test(typeName)) {
            return '@__FlintFieldInspector("gameobject")';
        }

        return null;
    }

    private static inferSerializeTypeDecorator(typeAnnotation: string): string | null {
        const parts = this.splitUnionType(typeAnnotation)
            .map(part => part.trim())
            .filter(part => part !== "undefined" && part !== "null");

        if (parts.length !== 1) {
            return null;
        }

        const typeName = parts[0]!.replace(/^readonly\s+/, "");

        // Match common serializable types
        if (/(^|\.)Vector2$/.test(typeName)) {
            return `@__FlintSerializeType(${typeName})`;
        }

        if (/(^|\.)Component$/.test(typeName)) {
            return `@__FlintSerializeType(${typeName})`;
        }

        if (/(^|\.)GameObject$/.test(typeName)) {
            return `@__FlintSerializeType(${typeName})`;
        }

        if (/(^|\.)Layer$/.test(typeName)) {
            return `@__FlintSerializeType(${typeName})`;
        }

        // For generic types like Map<K, V>, Store the constructor reference if it matches known serializable generics
        if (/^(Map|Set|Array)\s*</.test(typeName)) {
            return `@__FlintSerializeType(${typeName.split(/\s*</, 1)[0]})`;
        }

        return null;
    }

    private static addInferredSerializeTypeDecorators(content: string): string {
        const lines = content.split(/\r?\n/);
        const output: string[] = [];
        let changed = false;
        let decorators: string[] = [];

        for (const line of lines) {
            const trimmed = line.trim();

            if (trimmed.startsWith("@")) {
                output.push(line);
                decorators.push(trimmed);
                continue;
            }

            const field = line.match(/^(\s*)(?:(public|protected)\s+)?([A-Za-z_$][\w$]*)([!?])?\s*:\s*([^=;]+)([=;].*)?$/);
            if (field) {
                const hasExplicitSerializeType = decorators.some(decorator =>
                    /^@(SerializeType|NonSerialized)\b/.test(decorator)
                );

                if (!hasExplicitSerializeType) {
                    const indent = field[1] ?? "";

                    const serializeTypeDecorator = this.inferSerializeTypeDecorator(field[5] ?? "");
                    if (serializeTypeDecorator) {
                        output.push(`${indent}${serializeTypeDecorator}`);
                        changed = true;
                    }
                }

                output.push(line);
                decorators = [];
                continue;
            }

            output.push(line);

            if (trimmed.length > 0) {
                decorators = [];
            }
        }

        if (!changed) {
            return content;
        }

        return `${this.getInspectorMetadataImport()}\n${output.join("\n")}`;
    }

    private static splitUnionType(typeAnnotation: string): string[] {
        return typeAnnotation
            .split("|")
            .map(part => part.trim())
            .filter(part => part.length > 0);
    }

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


    public static async bundle(
        entryPoint: string = "/index.ts",
        sourceMap?: boolean,
        options: { stripEditorDecorators?: boolean } = {}
    ) {
        const previousStripEditorDecorators = Bundler.stripEditorDecorators;
        Bundler.stripEditorDecorators = options.stripEditorDecorators ?? false;

        try {
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
                ...(sourceMap ? { sourcemap: "inline" } : {})
            });
        } finally {
            Bundler.stripEditorDecorators = previousStripEditorDecorators;
        }
    }
}
