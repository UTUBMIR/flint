import type { RawProjectData } from "@flint/runtime/project-loader";
import { HotReloadBridge, type EngineSingletons } from "@flint/runtime/hot-reload-bridge";

type PreviewMessage = {
    type?: string;
    assets?: { id: string; url: string }[];
    code?: string;
    components?: string[];
};

export class EditorBridge {
    public static async attach(projectData: RawProjectData, source: EngineSingletons) {
        console.log("EditorBridge attached");

        window.opener?.postMessage("FLINT_PREVIEW_READY", "*");

        const promise = new Promise<void>((resolve) => {
            window.addEventListener("message", e => {
                const message = e.data as PreviewMessage;

                if (message?.type === "FLINT_ASSET_LIST") {
                    console.log("Received asset list in preview:", message.assets);

                    for (const asset of message.assets ?? []) {
                        projectData.assets.find(a => a.id === asset.id)!.url = asset.url;
                    }

                    resolve();
                }
                else if (message?.type === "FLINT_HOT_RELOAD") {
                    void HotReloadBridge.apply(message.code ?? "", message.components ?? [], source);
                }
            });
        });

        await promise;
    }
}
