import type Component from "@flint//runtime/component";
import { System } from "@flint/runtime/system";
import { Notifier } from "@flint/editor/editor";
import Bundler from "./bundler";
import ModuleLoader from "./module-loader";
import { Project } from "./project";
import ProjectConfig from "./project-config";
import { AbstractFileSystem } from "@flint/shared/file-system";
import type { AssetData } from "../asset-types";
import { AssetRegistry } from "@flint/runtime/assets";
import { ProjectLoader } from "@flint/runtime/project-loader";
import { HotReload } from "@flint/runtime/hot-reload";
import { editorAssetStore } from "../window-services";

import * as basicComponents from "@flint/runtime/components/index";
import * as physicsComponents from "@flint/runtime/components/physics-index";

export class Builder {
    private static tab: Window;
    private static tabUrl: string = "";

    private static compiled: string;

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
        options: { stripEditorDecorators?: boolean } = {}
    ): Promise<boolean> {
        const textFilesResult = await Project.getAllTextFiles();
        const textFiles = textFilesResult.files;
        const textAssets = textFilesResult.assets;


        for (const { path } of textFiles) {
            const text = await System.fileSystem.readTextFile(path);

            Bundler.files.set(path, text);
        }

        editorAssetStore.setAssets(textAssets as AssetData[]);

        try {
            const enableSourceMap = sourceMap ?? ProjectConfig.config?.generateJsMap ?? false;
            const result = (await Bundler.bundle(entryPoint, enableSourceMap, options)).outputFiles[0]?.text;

            if (!result) return false;

            this.compiled = result;

            return true;
        }
        catch (error) {
            if (emitErrorMessages) {
                Notifier.notify(`${error}`, "danger", 15000);
            }
            return false;
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
        Bundler.files.set("main.ts", this.makeMainTs(projectData, false));

        if (!await Builder.compile(true, "/main.ts", false, { stripEditorDecorators: true })) return false;

        await System.fileSystem.writeTextFile(
            "build/index.html",
            this.makeHtml(Builder.compiled, false)
        );

        return true;
    }

    public static async preview(): Promise<boolean> {
        const projectData = await this.loadProject();

        Bundler.files.clear();
        Bundler.files.set("index.ts", ProjectConfig.userIndex);
        Bundler.files.set("main.ts", this.makeMainTs(projectData, true));

        if (!await Builder.compile(true, "/main.ts", undefined, { stripEditorDecorators: true })) return false;

        const html = this.makeHtml(Builder.compiled, true);

        const blob = new Blob([html], { type: "text/html" });
        Builder.tabUrl = URL.createObjectURL(blob);

        Builder.openBuild();

        return true;
    }

    public static openBuild() {
        if (Builder.previewExists) {
            Builder.tab?.close();
            Builder.tab = window.open(Builder.tabUrl, "flint_preview")!;
        }
    }

    private static makeMainTs(data: string, preview: boolean) {
        return `import { System } from "@flint/runtime/system";
import * as basicComponents from "@flint/runtime/components/index";
import * as gameIndex from "./index";
import { Runtime } from "@flint/runtime/runtime";
${preview ? `import { EditorBridge } from "@flint/editor/editor-bridge";` : ""}
${ProjectConfig.config.usePhysics ? 'import { PhysicsWorld as World } from "@flint/runtime/physics-world";\nimport * as physicsComponents from "@flint/runtime/components/physics-index";' : 'import { World } from "./flint/runtime/world";'}
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
    
    ${preview ? `if (window.__FLINT_PREVIEW__) {
        console.warn("Launched in preview mode.");
        await EditorBridge.attach(projectData);
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
${preview ? "window.__FLINT_PREVIEW__ = true;" : ""}
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
        }
        else {
            return false;
        }

        return true;
    }
}
