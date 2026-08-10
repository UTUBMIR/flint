import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import esbuild from "esbuild";
import {
    defaultBuildConfig,
    generateMain,
    getUsedComponents,
    makeHtml,
    makeUserIndex,
    isAbsoluteUrl,
    normalizeAssetUrl,
    type BuildConfig,
    type RawProjectData
} from "@flint/build";
import { createVirtualFsPlugin } from "./virtual-fs-plugin";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const require = createRequire(import.meta.url);
const engineRoot = path.dirname(require.resolve("@flint/engine/package.json"));
const engineSrcDir = path.join(engineRoot, "src");

const SKIPPED_DIRS = new Set(["build", "flint", ".git", "node_modules", "dist"]);

export type BuildOptions = {
    output?: string;
    minify?: boolean;
};

function walkFiles(dir: string, baseDir: string, out: Map<string, string>, ext: string[]) {
    if (!fs.existsSync(dir)) return;

    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            if (!SKIPPED_DIRS.has(entry.name)) {
                walkFiles(fullPath, baseDir, out, ext);
            }
        } else if (entry.isFile()) {
            if (ext.some(e => entry.name.endsWith(e))) {
                const relPath = path.relative(baseDir, fullPath).replace(/\\/g, "/");
                out.set(relPath, fs.readFileSync(fullPath, "utf8"));
            }
        }
    }
}

function loadEngineFiles(): Map<string, string> {
    const flintFiles = new Map<string, string>();
    walkFiles(engineSrcDir, engineSrcDir, flintFiles, [".ts", ".js", ".json"]);

    const keyed = new Map<string, string>();
    for (const [relPath, content] of flintFiles) {
        keyed.set(`flint/${relPath}`, content);
    }
    return keyed;
}

function loadProjectFiles(projectDir: string): Map<string, string> {
    const files = new Map<string, string>();
    walkFiles(projectDir, projectDir, files, [".ts", ".json"]);
    return files;
}

function loadProjectJson<T>(projectDir: string, fileName: string): T | null {
    const filePath = path.join(projectDir, fileName);
    if (!fs.existsSync(filePath)) return null;
    return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function copyRegisteredAssets(projectDir: string, outputDir: string, assets: RawProjectData["assets"]): void {
    const copied = new Set<string>();

    for (const asset of assets) {
        const url = asset.url.replace(/\\/g, "/").replace(/^\.\//, "");

        if (isAbsoluteUrl(url)) {
            continue;
        }

        const srcPath = path.resolve(projectDir, normalizeAssetUrl(url));
        if (!srcPath.startsWith(path.resolve(projectDir) + path.sep)) {
            console.warn(`Skipping asset outside of project directory: ${asset.url}`);
            continue;
        }

        if (copied.has(srcPath)) {
            continue;
        }
        copied.add(srcPath);

        if (!fs.existsSync(srcPath)) {
            console.warn(`Asset file not found: ${asset.url}`);
            continue;
        }

        const destPath = path.join(outputDir, url);
        fs.mkdirSync(path.dirname(destPath), { recursive: true });
        fs.copyFileSync(srcPath, destPath);
    }
}

export async function buildProject(projectDir: string, options: BuildOptions = {}): Promise<void> {
    const projectDirAbs = path.resolve(projectDir);

    if (!fs.existsSync(path.join(projectDirAbs, "project.json"))) {
        throw new Error(`No project.json found in ${projectDirAbs}. Is this a flint project?`);
    }

    const projectData = loadProjectJson<RawProjectData>(projectDirAbs, "project.json");
    if (!projectData) {
        throw new Error("project.json is invalid.");
    }

    const config = {
        ...defaultBuildConfig,
        ...(loadProjectJson<Partial<BuildConfig>>(projectDirAbs, "project-config.json") ?? {})
    };

    const projectTsConfig = loadProjectJson<object>(projectDirAbs, "tsconfig.json");

    const files = loadProjectFiles(projectDirAbs);
    files.set("index.ts", makeUserIndex(config));
    files.set("main.ts", generateMain(projectData, config, "editor"));

    const flintFiles = loadEngineFiles();

    const result = await esbuild.build({
        entryPoints: ["/main.ts"],
        bundle: true,
        write: false,
        format: "esm",
        target: ["es2024"],
        platform: "browser",
        minify: options.minify ?? true,
        treeShaking: true,
        external: ["@flint/"],
        tsconfigRaw: projectTsConfig ?? undefined,
        plugins: [createVirtualFsPlugin({ files, flintFiles }, true, { moduleSearchPaths: [projectDirAbs] })]
    });

    const code = result.outputFiles[0]?.text;
    if (!code) {
        throw new Error("esbuild produced no output.");
    }

    const outputPath = path.resolve(options.output ?? path.join(projectDirAbs, "build", "index.html"));
    const outputDir = path.dirname(outputPath);
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(outputPath, makeHtml(code, false));

    copyRegisteredAssets(projectDirAbs, outputDir, projectData.assets);

    const usedComponents = getUsedComponents(projectData);
    console.log(`Built ${path.relative(process.cwd(), outputPath) || outputPath} (${usedComponents.length} components used).`);
}
