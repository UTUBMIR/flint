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

    private static readonly RESOLUTION_CANDIDATES: readonly string[] = [
        "",
        ".ts",
        ".d.ts",
        ".js",
        ".mjs",
        ".cjs",
        ".json",
        "/index.ts",
        "/index.d.ts",
        "/index.js",
        "/index.mjs",
        "/index.cjs",
        "/index.json"
    ];

    private static tryResolveCandidates(base: string): string | null {
        for (const suffix of Bundler.RESOLUTION_CANDIDATES) {
            const candidate = `${base}${suffix}`;
            if (Bundler.files.has(candidate)) return candidate;
        }
        return null;
    }

    private static resolveNodeModuleEntry(packageName: string, subPath: string, nodeModulesBase = "node_modules"): string | null {
        const baseNoSub = `${nodeModulesBase}/${packageName}`;
        if (!subPath) {
            const pkgJsonPath = `${baseNoSub}/package.json`;
            const pkgText = Bundler.files.get(pkgJsonPath);
            if (pkgText) {
                try {
                    const pkg = JSON.parse(pkgText);
                    const mainField = pkg.module ?? pkg.main ?? pkg.browser ?? pkg.types ?? pkg.typings;
                    if (typeof mainField === "string" && mainField) {
                        const normalizedMain = mainField.replace(/^\.?\//, "");
                        const mainFull = `${baseNoSub}/${normalizedMain}`;
                        const resolved = Bundler.tryResolveCandidates(mainFull) ?? (Bundler.files.has(mainFull) ? mainFull : null);
                        if (resolved) return resolved;
                    }
                } catch { /* ignore parse errors */ }
            }
            return Bundler.tryResolveCandidates(baseNoSub);
        }
        const withSub = `${nodeModulesBase}/${packageName}/${subPath}`;
        return Bundler.tryResolveCandidates(withSub) ?? (Bundler.files.has(withSub) ? withSub : null);
    }

    private static resolveBareSpecifier(packageName: string, subPath: string, importerDir: string): string | null {
        const dirs: string[] = [];
        let cur = importerDir.replace(/\\/g, "/").replace(/^\.\//, "");
        if (!cur || cur === ".") dirs.push("");
        else {
            const parts = cur.split("/").filter(Boolean);
            for (let i = parts.length; i >= 0; i--) dirs.push(parts.slice(0, i).join("/"));
            if (!dirs.includes("")) dirs.push("");
        }
        for (const d of dirs) {
            const base = d ? `${d}/node_modules` : "node_modules";
            const r = Bundler.resolveNodeModuleEntry(packageName, subPath, base);
            if (r) return r;
        }
        return Bundler.resolveNodeModuleEntry(packageName, subPath);
    }

    private static isBareSpecifier(path: string): boolean {
        if (!path) return false;
        if (path.startsWith(".") || path.startsWith("/") || path.startsWith("@flint")) return false;
        return true;
    }

    private static parseBareSpecifier(spec: string): { packageName: string; subPath: string } | null {
        if (!spec) return null;
        // Remove query/hash
        const clean = spec.split("?")[0]!.split("#")[0]!;
        if (clean.startsWith("@")) {
            const parts = clean.split("/");
            if (parts.length < 2) return null;
            const packageName = `${parts[0]}/${parts[1]}`;
            const subPath = parts.slice(2).join("/");
            return { packageName, subPath };
        }
        const slash = clean.indexOf("/");
        if (slash === -1) return { packageName: clean, subPath: "" };
        return { packageName: clean.slice(0, slash), subPath: clean.slice(slash + 1) };
    }

    private static createVirtualFsPlugin(stripEditorDecorators: boolean) {
        // Engine files are static while the editor is running - cache transformed result once
        // User-project files are always re-transformed.
        const flintCache = new Map<string, { contents: string; loader: "ts" | "js" | "json" }>();

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

            const cached = flintCache.get(flintPath);
            if (cached) return cached;

            const transformed = Bundler.transformSource(content, flintPath, stripEditorDecorators);
            const loader = flintPath.endsWith(".ts") ? "ts" : flintPath.endsWith(".js") ? "js" : "json";
            const result = { contents: transformed, loader } as const;
            flintCache.set(flintPath, result);
            return result;
        };

        return {
            name: "virtual-fs",
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            setup(build: any) {
                build.onResolve({ filter: /.*/ }, (args: { path: string; resolveDir: string; importer: string }) => {
                    function run() {
                        const rawPath = args.path;

                        // 1) Bare specifier (npm package) -> node_modules resolution including package.json main
                        if (Bundler.isBareSpecifier(rawPath)) {
                            const parsed = Bundler.parseBareSpecifier(rawPath);
                            if (parsed) {
                                const importerDir = (args.importer ? args.importer.replace(/\/[^/]*$/, "") : args.resolveDir || "").replace(/\\/g, "/").replace(/^\.\//, "");
                                const resolved = Bundler.resolveBareSpecifier(parsed.packageName, parsed.subPath, importerDir);
                                if (resolved) return { path: resolved, namespace: "virtual" };
                                const base = `node_modules/${parsed.packageName}${parsed.subPath ? `/${parsed.subPath}` : ""}`;
                                return { path: base, namespace: "virtual" };
                            }
                        }

                        const importPath = args.path.endsWith(".ts") || args.path.endsWith(".json") || args.path.endsWith(".js") || args.path.endsWith(".mjs") || args.path.endsWith(".cjs") ? args.path : args.path + ".ts";

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

                        // Relative import inside node_modules package: resolve against importer dir
                        // If importer is inside node_modules, already handled via relative branch above

                        return {
                            path: normalized.startsWith(".") ? normalized.slice(2, normalized.length) : normalized,
                            namespace: "virtual",
                        };
                    }
                    const result = run();
                    return result;
                });

                build.onLoad({ filter: /.*/, namespace: "virtual" }, async (args: { path: string }) => {
                    if (args.path.startsWith("@flint")) {
                        let flintPath = "flint/" + args.path.replace("@flint/", "");
                        const { contents, loader } = getFlintContent(flintPath);
                        return { contents, loader };
                    }

                    const normalizedPath = args.path;

                    // Try exact, then fallback extensions for node_modules (ts-first, then js)
                    let content: string | undefined = Bundler.files.get(normalizedPath);
                    let effectivePath = normalizedPath;
                    if (content === undefined) {
                        const variants = [
                            `${normalizedPath}.ts`,
                            `${normalizedPath}.d.ts`,
                            `${normalizedPath}.js`,
                            `${normalizedPath}.mjs`,
                            `${normalizedPath}.cjs`,
                            `${normalizedPath}.json`,
                            `${normalizedPath}/index.ts`,
                            `${normalizedPath}/index.d.ts`,
                            `${normalizedPath}/index.js`,
                            `${normalizedPath}/index.mjs`
                        ];
                        for (const v of variants) {
                            const c = Bundler.files.get(v);
                            if (c !== undefined) {
                                content = c;
                                effectivePath = v;
                                break;
                            }
                        }
                    }
                    if (content === undefined) {
                        const flintContent =
                            Bundler.flintFiles.get(normalizedPath) ??
                            Bundler.flintFiles.get(normalizedPath.replace(".ts", ".js"));
                        if (flintContent) {
                            const { contents, loader } = getFlintContent(normalizedPath);
                            return { contents, loader };
                        }

                        console.warn("Missing virtual file:", normalizedPath);
                        const pkgForError = (() => {
                            const m = normalizedPath.match(/^node_modules\/((?:@[^/]+\/)?[^/]+)/);
                            return m?.[1] ?? normalizedPath;
                        })();
                        throw new Error(`Cannot find module '${pkgForError}' or its corresponding type declarations.`);
                    }

                    const loader = effectivePath.endsWith(".json") ? "json" : effectivePath.endsWith(".ts") || effectivePath.endsWith(".d.ts") ? "ts" : "js";
                    return {
                        contents: Bundler.transformSource(content, effectivePath, true),
                        loader
                    };
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
