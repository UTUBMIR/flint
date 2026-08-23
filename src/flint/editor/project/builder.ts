import type Component from "@flint/runtime/component";
import { System } from "@flint/runtime/system";
import { ProcessIndicator } from "@flint/editor/editor";
import Editor from "@flint/editor/editor";
import { Notifier } from "../notifier";
import Bundler from "./bundler";
import ModuleLoader from "./module-loader";
import { Project } from "./project";
import ProjectConfig from "./project-config";
import { AbstractFileSystem } from "@flint/shared/file-system";
import type { AssetData } from "../asset-types";
import { isAbsoluteUrl, normalizeAssetUrl } from "./asset-paths";
import { AssetRegistry } from "@flint/runtime/assets";
import { ProjectLoader, type RawProjectData } from "@flint/runtime/project-loader";
import { HotReload } from "@flint/runtime/hot-reload";
import { editorAssetStore } from "../ui/window-services";

import * as basicComponents from "@flint/runtime/components/index";
import * as physicsComponents from "@flint/runtime/components/physics-index";

export class Builder {
    private static tab: Window;
    private static tabUrl: string = "";

    private static compiled: string;

    public static get compiledCode(): string {
        return Builder.compiled;
    }

    public static async copyAssetsToBuild(): Promise<void> {
        if (!System.fileSystem.started) {
            return;
        }

        let assets: RawProjectData["assets"] | undefined;
        try {
            if (!await System.fileSystem.fileExists("project.json")) {
                return;
            }
            assets = (JSON.parse(await System.fileSystem.readTextFile("project.json")) as RawProjectData).assets;
        } catch (error) {
            console.warn("Failed to read project.json for asset copying:", error);
            return;
        }

        if (!Array.isArray(assets)) {
            return;
        }

        const uniqueDirs = new Set<string>();
        const copies: { source: string; dest: string }[] = [];

        for (const meta of assets) {
            if (isAbsoluteUrl(meta.url)) {
                continue;
            }

            const source = normalizeAssetUrl(meta.url);
            if (!source) {
                continue;
            }

            const dest = meta.url.replace(/^\/+/, "");
            if (!dest) {
                continue;
            }

            copies.push({ source, dest });
            uniqueDirs.add("build/" + dest.replace(/\/[^/]*$/, ""));
        }

        await Promise.all([...uniqueDirs].map(dir => Builder.ensureDirectory(dir)));

        await Promise.allSettled(copies.map(({ source, dest }) => (async () => {
            try {
                const data = await System.fileSystem.readFile(source);
                await System.fileSystem.writeFile("build/" + dest, data);
            } catch (error) {
                if (await System.fileSystem.fileExists(source)) {
                    console.warn(`Failed to copy asset "${source}" to build:`, error);
                }
            }
        })));
    }

    private static async ensureDirectory(path: string): Promise<void> {
        const dirPath = path.replace(/\/[^/]*$/, "");
        if (!dirPath) {
            return;
        }

        let current = "";
        for (const part of dirPath.split("/")) {
            current = current ? `${current}/${part}` : part;

            let exists = false;
            try {
                exists = await System.fileSystem.dirExists(current);
            } catch {
                exists = false;
            }

            if (!exists) {
                await System.fileSystem.createDir(current);
            }
        }
    }

    public static get previewExists(): boolean {
        return !!Builder.tabUrl;
    }

    public static get previewUrl() {
        return Builder.tabUrl;
    }

    private constructor() { }

    static {
        window.addEventListener("message", async (e: MessageEvent) => {
            if (e.data === "FLINT_PREVIEW_READY") {
                console.log("Preview is ready! Sending assets...");

                async function prepareUrl(url: string): Promise<string> {
                    function isAbsolute(url: string): boolean {
                        return url.indexOf('://') > 0 || url.indexOf('//') === 0;
                    }

                    if (isAbsolute(url)) {
                        return url;
                    }
                    else {
                        // fetch the data from the url
                        const data = await System.fileSystem.readFile("build/" + url);
                        const blob = new Blob([AbstractFileSystem.toArrayBuffer(data)]);
                        // create object url from blob
                        return URL.createObjectURL(blob);
                    }
                }

                Builder.tab.postMessage({
                    type: "FLINT_ASSET_LIST",
                    assets: await Promise.all(
                        [...AssetRegistry.meta.values()]
                            .map(async v => ({ id: v.id, url: await prepareUrl(v.url) }))
                    )
                }, "*");
            }
        });
    }

    public static async compile(
        emitErrorMessages: boolean = true,
        entryPoint?: string,
        sourceMap?: boolean,
        options: { stripEditorDecorators?: boolean; incrementalRebuilds?: boolean } = {}
    ): Promise<boolean> {
        const started = performance.now();
        const processActions = ProcessIndicator.startProcess("Compiling the project", "primary");

        const copyAssetsPromise = Builder.copyAssetsToBuild();

        const textFilesResult = await Project.getAllTextFiles();
        const textFiles = textFilesResult.files;
        const textAssets = textFilesResult.assets;

        await Promise.all(textFiles.map(async ({ path }) => {
            const text = await System.fileSystem.readTextFile(path);

            Bundler.files.set(path, text);
        }));

        editorAssetStore.setAssets(textAssets as AssetData[]);

        try {
            const enableSourceMap = sourceMap ?? ProjectConfig.config?.generateJsMap ?? false;
            const incrementalRebuilds = options.incrementalRebuilds ?? ProjectConfig.config?.incrementalRebuilds ?? true;
            const buildResult = await Bundler.bundle(entryPoint, enableSourceMap, { ...options, incrementalRebuilds });
            const result = buildResult.outputFiles?.[0]?.text;

            if (!result) return false;

            this.compiled = result;

            processActions.complete(`Compiled in ${Math.round(performance.now() - started)} ms`);

            return true;
        }
        catch (error) {
            if (emitErrorMessages) {
                Notifier.notify(`${error}`, "danger", 15000);
            }
            processActions.fail("Compilation failed");
            return false;
        }
        finally {
            await copyAssetsPromise;
        }
    }

    private static async loadProject(): Promise<string> {
        const json = await System.fileSystem.readTextFile("project.json");

        return json;
    }

    public static async build(): Promise<boolean> {
        if (!System.fileSystem.started) return false;

        const projectData = await this.loadProject();

        Bundler.files.clear();
        Bundler.files.set("index.ts", ProjectConfig.userIndex);
        Bundler.files.set("main.ts", this.makeMainTs(projectData, "editor"));

        if (!await Builder.compile(true, "/main.ts", false, { stripEditorDecorators: true })) return false;

        await System.fileSystem.writeTextFile(
            "build/index.html",
            this.makeHtml(Builder.compiled, false)
        );

        return true;
    }

    private static async compilePreview(mode: "editor" | "preview" | "live"): Promise<{ code: string; project: RawProjectData } | null> {
        if (!System.fileSystem.started) return null;

        const projectData = await this.loadProject();

        Bundler.files.clear();
        Bundler.files.set("index.ts", ProjectConfig.userIndex);
        Bundler.files.set("main.ts", this.makeMainTs(projectData, mode));

        if (!await Builder.compile(true, "/main.ts", undefined, { stripEditorDecorators: true })) return null;

        return { code: Builder.compiled, project: JSON.parse(projectData) as RawProjectData };
    }

    public static async preview(): Promise<boolean> {
        const result = await this.compilePreview("preview");
        if (!result) return false;

        const html = this.makeHtml(result.code, true);

        const blob = new Blob([html], { type: "text/html" });
        Builder.tabUrl = URL.createObjectURL(blob);

        Builder.openBuild();

        return true;
    }

    public static async compileLive(): Promise<{ code: string; project: RawProjectData } | null> {
        return this.compilePreview("live");
    }

    public static openBuild() {
        if (Builder.previewExists) {
            Builder.tab?.close();
            Builder.tab = window.open(Builder.tabUrl, "flint_preview")!;
        }
    }

    private static makeMainTs(data: string, mode: "editor" | "preview" | "live") {
        const preview = mode === "preview";
        const live = mode === "live";

        return `import { System } from "@flint/runtime/system";
import * as basicComponents from "@flint/runtime/components/index";
import * as gameIndex from "./index";
import { Runtime } from "@flint/runtime/runtime";
${preview ? `import { EditorBridge } from "@flint/editor/project/editor-bridge";` : ""}
${live ? `import { LivePreviewBridge } from "@flint/runtime/live-preview-bridge";` : ""}
${preview || live ? `import { AssetRegistry } from "@flint/runtime/assets";
import { TimerSystem } from "@flint/runtime/timers";
import Input from "@flint/shared/input";
import Metadata from "@flint/shared/metadata";
import Camera from "@flint/runtime/components/camera";
import { HotReload } from "@flint/runtime/hot-reload";` : ""}
${ProjectConfig.config.usePhysics ? 'import { PhysicsWorld as World } from "@flint/runtime/physics-world";\nimport * as physicsComponents from "@flint/runtime/components/physics-index";' : 'import { World } from "@flint/runtime/world";'}
import { ProjectLoader } from "@flint/runtime/project-loader";

(async () => {
    const projectData = ${data};

    const components = {
    ${(function () {
                const usedComponents = ProjectLoader.getUsedComponents(JSON.parse(data));
                const lines: string[] = [];

                for (const c of usedComponents) {
                    if (c in basicComponents) {
                        lines.push(`"${c}": basicComponents.${c},`);
                    }
                    else if (c in physicsComponents) {
                        lines.push(`"${c}": physicsComponents.${c},`);
                    }
                    else { // It's in gameIndex
                        lines.push(`"${c}": gameIndex.${c},`);
                    }
                }

                return lines.join("");
            })()
            }
    }

    const world = ${ProjectConfig.config.usePhysics
                ? `new World({ x: ${ProjectConfig.config.physicsGravityX}, y: ${ProjectConfig.config.physicsGravityY} }, ${ProjectConfig.config.physicsPixelsPerMeter})`
                : "new World()"
            };

    const runtime = new Runtime({
        components: components,
        projectData,
        enableMetadata: true,
        world
    });
    
    ${preview ? `if (window.FLINT_PREVIEW) {
        console.warn("Launched in preview mode.");
        await EditorBridge.attach(projectData, {
            System, Camera, Input, Metadata, AssetRegistry, TimerSystem, HotReload
        });
    }` : ""}
    ${live ? `if (window.FLINT_LIVE_PREVIEW) {
        console.warn("Launched in live-preview mode.");
        await LivePreviewBridge.attach(projectData, {
            System, Camera, Input, Metadata, AssetRegistry, TimerSystem, HotReload
        });
    }` : ""}

    await runtime.start();
})();`;
    } // FIXME: Metadata should not be included in release build

    private static makeHtml(js: string, preview: boolean) {
        return `
<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Build</title></head>
<style>
html {
    height: 100%;
    width: 100%;
}
:root {
    touch-action: none;
    height: 100%;

    -webkit-touch-callout: none;
    -webkit-user-select: none;
    -khtml-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
}
body {
    margin: 0;
    padding: 0;
    width: 100%;
    height: 100%;
    overflow: hidden;
    background-color: #222;
}
canvas {
    position: absolute;
}
#root {
    width: 100%;
    height: 100%;
    touch-action: none;
}
</style>
<body>
<div id="root"></div>
<script>
${preview ? "window.FLINT_PREVIEW = true;" : ""}
${js}
</script>
</body>
</html>`;
    }



    public static async buildForEditor(emitErrorMessages: boolean = true): Promise<boolean> {
        if (!System.fileSystem.started) {
            Notifier.notify("Open project first.", "danger");
            return false;
        }
        await Promise.all([Bundler.esbuildReady, Editor.engineFilesReady]);
        Bundler.files.clear();
        Bundler.files.set("index.ts", ProjectConfig.fullIndex);

        if (await Builder.compile(emitErrorMessages)) {
            const module = await ModuleLoader.load(Builder.compiled);

            for (const { name } of ProjectConfig.config.components) {
                const value = module[name];

                if (value as Component) {
                    HotReload.reloadComponent(name, value as typeof Component);
                }
            }

            Builder.pushHotReloadToPreview();
        }
        else {
            return false;
        }

        return true;
    }

    private static pushHotReloadToPreview() {
        if (!Builder.previewExists || !Builder.tab || Builder.tab.closed) return;

        Builder.tab.postMessage({
            type: "FLINT_HOT_RELOAD",
            code: Builder.compiled,
            components: ProjectConfig.config.components.map(c => c.name)
        }, "*");
    }
}
