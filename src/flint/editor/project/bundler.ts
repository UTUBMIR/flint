import ProjectConfig from "./project-config";

declare const FLINT_ESBUILD_MODULE_URL: string;
declare const FLINT_ESBUILD_WASM_URL: string;
const dynamicImport = new Function("url", "return import(url);") as (url: string) => Promise<{ default: typeof import("esbuild-wasm") }>;

export default class Bundler {
    public static files = new Map<string, string>();
    public static flintFiles = new Map<string, string>();

    private static _resolveEsbuildReady: () => void;
    public static esbuildReady: Promise<void>;

    private static esbuild: typeof import("esbuild-wasm");
    private static contexts = new Map<string, import("esbuild-wasm").BuildContext>();

    static {
        Bundler.esbuildReady = new Promise<void>((resolve) => {
            Bundler._resolveEsbuildReady = resolve;
        });
    }
    private static readonly editorDecoratorPattern =
        /^\s*@(HideInInspector|ShowInInspector|NonSerialized|FieldInspector|SelectInspector)(\s*\([^)]*\))?\s*$/gm;

    private static getInspectorMetadataImport(stripEditorDecorators: boolean): string {
        if (stripEditorDecorators) {
            return 'import { SerializeType as __FlintSerializeType } from "@flint/shared/metadata";';
        }
        return 'import { FieldInspector as __FlintFieldInspector, SelectInspector as __FlintSelectInspector, SerializeType as __FlintSerializeType } from "@flint/shared/metadata";';
    }

    private static createVirtualFsPlugin(stripEditorDecorators: boolean) {
        // Incremental cache: flint (engine) files are transformed once and reused
        // across rebuilds while their raw content is unchanged; a content-hash
        // mismatch invalidates the entry so updated engine code is picked up.
        // User-project files are always treated as changed and re-transformed.
        const flintCache = new Map<string, { hash: number; result: { contents: string; loader: "ts" | "js" | "json" } }>();

        const hashContent = (content: string): number => {
            let h = 5381;
            for (let i = 0; i < content.length; i++) {
                h = (((h << 5) + h) | 0) + content.charCodeAt(i) | 0;
            }
            return h;
        };

        const getFlintContent = (flintPath: string) => {
            let content = Bundler.flintFiles.get(flintPath);
            if (content === undefined && flintPath.endsWith(".ts")) {
                const jsPath = flintPath.replace(".ts", ".js");
                const jsContent = Bundler.flintFiles.get(jsPath);
                if (jsContent !== undefined) {
                    flintPath = jsPath;
                    content = jsContent;
                }
            }

            if (content === undefined) {
                const fallbackLoader = flintPath.endsWith(".json") ? "json" : "ts";
                return { contents: "export {}", loader: fallbackLoader } as const;
            }

            const hash = hashContent(content);
            const cached = flintCache.get(flintPath);
            if (cached && cached.hash === hash) {
                return cached.result;
            }

            const transformed = Bundler.transformSource(content, flintPath, stripEditorDecorators);
            const loader = flintPath.endsWith(".ts") ? "ts" : flintPath.endsWith(".js") ? "js" : "json";
            const result = { contents: transformed, loader } as const;
            flintCache.set(flintPath, { hash, result });
            return result;
        };

        return {
            name: "virtual-fs",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setup(build: any) {
                build.onResolve({ filter: /.*/ }, (args: { path: string; resolveDir: string; importer: string }) => {
                    function run() {
                        const importPath = args.path.endsWith(".ts") || args.path.endsWith(".json") ? args.path : args.path + ".ts";

                        if (importPath.startsWith("@flint")) {
                            return {
                                path: importPath,
                                namespace: "virtual",
                            };
                        }

                        let baseDir = args.importer ? args.importer.replace(/\/[^/]*$/, "") : args.resolveDir;

                        baseDir = baseDir.replace(/\\/g, "/");

                        const baseSegments = baseDir.split("/").filter(Boolean);
                        const importSegments = importPath.split("/").filter(Boolean);

                        const resolvedSegments: string[] = [];

                        if (!baseDir.includes(".") && (importPath.startsWith("./") || importPath.startsWith("../"))) {
                            resolvedSegments.push(...baseSegments);

                            for (const seg of importSegments) {
                                if (seg === ".") continue;
                                if (seg === "..") resolvedSegments.pop();
                                else resolvedSegments.push(seg);
                            }
                        } else {
                            resolvedSegments.push(...importSegments);
                        }

                        const normalized = resolvedSegments.join("/");

                        return {
                            path: normalized.startsWith(".") ? normalized.slice(2, normalized.length) : normalized,
                            namespace: "virtual",
                        };
                    }
                    const result = run();
                    return result;
                });

                build.onLoad({ filter: /.*/, namespace: "virtual" }, async (args: { path: string }) => {
                    function run() {
                        if (args.path.startsWith("@flint")) {
                            let flintPath = "flint/" + args.path.replace("@flint/", "");
                            const { contents, loader } = getFlintContent(flintPath);
                            return { contents, loader };
                        }

                        const normalizedPath = args.path;

                        const content = Bundler.files.get(normalizedPath);
                        if (!content) {
                            const flintContent =
                                Bundler.flintFiles.get(normalizedPath) ??
                                Bundler.flintFiles.get(normalizedPath.replace(".ts", ".js"));
                            if (flintContent) {
                                const { contents, loader } = getFlintContent(normalizedPath);
                                return { contents, loader };
                            }

                            console.warn("Missing virtual file:", normalizedPath);
                            return { contents: "export {}", loader: "ts" };
                        }

                        return {
                            contents: Bundler.transformSource(content, normalizedPath, true),
                            loader: normalizedPath.endsWith(".ts") ? "ts" : "json"
                        };
                    }
                    const result = run();
                    return result;
                });
            }
        };
    }


    private constructor() { }

    private static transformSource(content: string, path: string, stripEditorDecorators: boolean, autoDetectInspectors = false): string {
        if (!path.endsWith(".ts")) {
            return content;
        }

        let result: string;

        if (stripEditorDecorators) {
            const stripped = content.replace(this.editorDecoratorPattern, "");
            if (!autoDetectInspectors || path.endsWith(".d.ts")) {
                result = stripped;
            } else {
                result = this.addInferredSerializeTypeDecorators(stripped, stripEditorDecorators);
            }
        } else if (!autoDetectInspectors || path.endsWith(".d.ts")) {
            result = content;
        } else {
            result = this.addInferredInspectorDecorators(content, stripEditorDecorators);
        }

        return result;
    }

    private static addInferredInspectorDecorators(content: string, stripEditorDecorators: boolean): string {
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

        return `${this.getInspectorMetadataImport(stripEditorDecorators)}\n${output.join("\n")}`;
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

        if (/^(Map|Set|Array)\s*</.test(typeName)) {
            return `@__FlintSerializeType(${typeName.split(/\s*</, 1)[0]})`;
        }

        return null;
    }

    private static addInferredSerializeTypeDecorators(content: string, stripEditorDecorators: boolean): string {
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

        return `${this.getInspectorMetadataImport(stripEditorDecorators)}\n${output.join("\n")}`;
    }

    private static splitUnionType(typeAnnotation: string): string[] {
        return typeAnnotation
            .split("|")
            .map(part => part.trim())
            .filter(part => part.length > 0);
    }

    public static async init() {
        try {
            if (!Bundler.esbuild) {
                const { default: esbuild } = await dynamicImport(FLINT_ESBUILD_MODULE_URL);
                await esbuild.initialize({
                    wasmURL: new URL(FLINT_ESBUILD_WASM_URL, window.location.href).toString(),
                });

                Bundler.esbuild = esbuild;
            }
        } finally {
            Bundler._resolveEsbuildReady();
        }
        return Bundler;
    }

    private static makeContextKey(entryPoint: string, sourceMap: boolean, stripEditorDecorators: boolean, tsconfigRaw: string): string {
        return JSON.stringify([entryPoint, sourceMap, stripEditorDecorators, tsconfigRaw]);
    }

    public static async bundle(
        entryPoint: string = "/index.ts",
        sourceMap?: boolean,
        options: { stripEditorDecorators?: boolean; incrementalRebuilds?: boolean } = {}
    ) {
        await Bundler.esbuildReady;
        const stripEditorDecorators = options.stripEditorDecorators ?? false;
        const enableSourceMap = !!sourceMap;
        // When incremental rebuilds are disabled the cached context is thrown
        // away after every compile, so each build re-resolves and re-parses
        // everything from scratch.
        const incremental = options.incrementalRebuilds ?? true;
        const key = Bundler.makeContextKey(entryPoint, enableSourceMap, stripEditorDecorators, ProjectConfig.tsConfig);

        let context = incremental ? Bundler.contexts.get(key) : undefined;
        if (!context) {
            context = await Bundler.esbuild.context({
                entryPoints: [entryPoint],
                bundle: true,
                write: false,
                format: "esm",
                target: ["es2024"],
                plugins: [Bundler.createVirtualFsPlugin(stripEditorDecorators)],
                external: ["@flint/"],
                platform: "browser",
                minify: true,
                keepNames: false,
                tsconfigRaw: ProjectConfig.tsConfig,
                treeShaking: true,
                ...(enableSourceMap ? { sourcemap: "inline" } : {})
            });
            if (incremental) {
                Bundler.contexts.set(key, context);
            }
        }
        try {
            return await context.rebuild();
        } finally {
            if (!incremental) {
                await context.dispose();
                Bundler.contexts.delete(key);
            }
        }
    }

    public static async disposeAll() {
        const contexts = [...Bundler.contexts.values()];
        Bundler.contexts.clear();
        await Promise.allSettled(contexts.map(c => c.dispose()));
    }
}