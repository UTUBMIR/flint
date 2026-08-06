import {
    defaultBuildConfig,
    getUsedComponents,
    type BuildConfig,
    type RawProjectData
} from "./project-data";

export type BuildMode = "editor" | "preview" | "live";

const basicComponentNames = new Set(["Camera", "Shape", "Transform", "Label", "Image"]);
const physicsComponentNames = new Set(["Collider", "BoxCollider", "PhysicsBody"]);

const engineIndex =
    `export * from "@flint/runtime/system";` +
    `export { default as Camera } from "@flint/runtime/components/camera";` +
    `export { default as Input } from "@flint/shared/input";` +
    `export { default as Metadata } from "@flint/shared/metadata";` +
    `export * from "@flint/runtime/assets";` +
    `export * from "@flint/runtime/timers";`;

export function makeUserIndex(config: BuildConfig): string {
    return config.components.map(c => `export {${c.name}} from "${c.file}";`).join("");
}

export function makeFullIndex(config: BuildConfig): string {
    return engineIndex + config.components.map(c => `export {${c.name}} from "${c.file}";`).join("");
}

export function generateMain(
    projectData: RawProjectData,
    config: BuildConfig,
    mode: BuildMode
): string {
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
${config.usePhysics ? 'import { PhysicsWorld as World } from "@flint/runtime/physics-world";\nimport * as physicsComponents from "@flint/runtime/components/physics-index";' : 'import { World } from "@flint/runtime/world";'}
import { ProjectLoader } from "@flint/runtime/project-loader";

(async () => {
    const projectData = ${JSON.stringify(projectData)};

    const components = {
    ${(function () {
                const usedComponents = getUsedComponents(projectData);
                const lines: string[] = [];

                for (const c of usedComponents) {
                    if (basicComponentNames.has(c)) {
                        lines.push(`"${c}": basicComponents.${c},`);
                    }
                    else if (physicsComponentNames.has(c)) {
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

    const world = ${config.usePhysics
                ? `new World({ x: ${config.physicsGravityX}, y: ${config.physicsGravityY} }, ${config.physicsPixelsPerMeter})`
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
}

export { defaultBuildConfig, getUsedComponents, type BuildConfig, type RawProjectData } from "./project-data";
