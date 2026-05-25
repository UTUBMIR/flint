import type { RawProjectData } from "@flint/runtime/project-loader";

export class EditorBridge {
    public static async attach(projectData: RawProjectData) {
        console.log("EditorBridge attached");

        window.opener?.postMessage("FLINT_PREVIEW_READY", "*");

        const promise = new Promise<void>((resolve) => {
            window.addEventListener("message", e => {
                if (e.data?.type === "FLINT_ASSET_LIST") {
                    console.log("Received asset list in preview:", e.data.assets);

                    for (const asset of e.data.assets as { id: string; url: string }[]) {
                        projectData.assets.find(a => a.id === asset.id)!.url = asset.url;
                    }

                    resolve();
                }
            });
        });

        await promise;
    }
}
