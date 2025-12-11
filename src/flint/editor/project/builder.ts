import type Component from "../..//runtime/component";
import { System } from "../../runtime/system";
import Editor, { Notifier } from "../../editor/editor";
import Bundler from "./bundler";
import ModuleLoader from "./module-loader";
import { Project } from "./project";
import ProjectConfig from "./project-config";

export class Builder {
    private static tab: Window;
    private static compiled: string;

    private constructor() { }

    public static async compile(emitErrorMessages: boolean = true, entryPoint?: string): Promise<boolean> {
        const textFilesResult = await Project.getAllTextFiles(Project.folderHandle);
        const textFiles = textFilesResult.files;
        const textAssets = textFilesResult.assets;


        for (const { fileHandle, path } of textFiles) {
            const file = await fileHandle.getFile();
            const text = await file.text();

            Bundler.files.set(path, text);
        }
        try {
            const result = (await Bundler.bundle(entryPoint)).outputFiles[0]?.text;

            if (!result) return false;

            this.compiled = result;

            Editor.assetsWindow.clearAssets();
            for (const asset of textAssets) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                Editor.assetsWindow.addAsset(asset as any);//FIXME: WTF?!?
            }

            return true;
        }
        catch (error) {
            if (emitErrorMessages) {
                Notifier.notify(`${error}`, "danger", 15000);
            }
            return false;
        }
    }

    public static async build(): Promise<boolean> {
        if (!Project.folderHandle) {
            Notifier.notify("Open project first.", "danger");
            return false;
        }

        const buildFolder = await Project.folderHandle.getDirectoryHandle("build", { create: true });

        const fileHandle = await Project.folderHandle.getFileHandle("project.gz");
        const file = await fileHandle.getFile();
        const ds = new DecompressionStream("gzip");
        const decompressed = await new Response(file.stream().pipeThrough(ds)).arrayBuffer();
        const decodedLayers = new TextDecoder().decode(decompressed);


        Bundler.files.clear();
        Bundler.files.set("index.ts", ProjectConfig.userIndex);
        Bundler.files.set("main.ts",
            `import * as index from "./index";
import { Renderer2D } from "@flint/shared/renderer2d";
import { System } from "@flint/runtime/system";
import { ProjectLoader } from "@flint/runtime/project-loader";

System.init(new Renderer2D());

for (const [name, _] of Object.entries(index)) {
    const value = index[name];
    System.components.set(name, value as any);
}
const projectData = ProjectLoader.deserialize(\`${decodedLayers}\`);

for (const layer of projectData.layers) System.pushLayer(layer);

System.run();
`);

        if (await Builder.compile(true, "/main.ts")) {
            const html =
                `<!DOCTYPE html>
<html>
<head><meta charset="UTF-8"><title>Build</title></head>
<style>
body {
    margin: 0;
    padding: 0;
    width: 100vw;
    height: 100vh;
    overflow: hidden;
}
canvas {
    position: absolute;
}
#root {
    width: 100%;
    height: 100%;
}
</style>
<body>
<div id="root"></div>
<script>
${Builder.compiled}
</script>
</body>
</html>`;
            const fileHandle = await buildFolder.getFileHandle("index.html", { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(html);
            await writable.close();
            const file = await fileHandle.getFile();
            const url = URL.createObjectURL(file);

            if (Builder.tab) {
                Builder.tab.close();
            }
            Builder.tab = window.open(url, "build")!;
        }
        else {
            return false;
        }

        return true;
    }

    public static async buildForEditor(emitErrorMessages: boolean = true): Promise<boolean> {
        if (!Project.folderHandle) {
            Notifier.notify("Open project first.", "danger");
            return false;
        }

        Bundler.files.clear();
        Bundler.files.set("index.ts", ProjectConfig.fullIndex);

        if (await Builder.compile(emitErrorMessages)) {
            const module = await ModuleLoader.load(Builder.compiled);

            for (const { name } of ProjectConfig.config.components) {
                const value = module[name];

                const oldComponentType = System.components.get(name);
                if (value as Component) {
                    System.components.set(name, value as typeof Component);
                }

                if (!oldComponentType || !oldComponentType.prototype) {
                    continue;
                }


                const component = System.components.get(name);
                if (!component) throw new Error("FLINT PANIC: CRITICAL SYSTEM FAILURE");

                for (const layer of System.layers) {
                    for (const obj of layer.getObjects()) {
                        const objComponent = obj.getComponent(oldComponentType);
                        if (!objComponent) {
                            continue;
                        }

                        Object.setPrototypeOf(objComponent, component.prototype);
                    }
                }

            }
        }
        else {
            return false;
        }

        return true;
    }
}