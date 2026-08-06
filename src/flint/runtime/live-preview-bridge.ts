import type { RawProjectData } from "./project-loader";
import type { AssetMeta } from "./assets";
import { HotReloadBridge, type EngineSingletons } from "./hot-reload-bridge";

type LivePreviewConnection = {
    onData(callback: (data: unknown) => void): void;
};

export type LivePreviewMessage =
    | { type: "start"; code: string }
    | { type: "asset"; id: string; data: ArrayBuffer }
    | { type: "hot-reload"; code: string; components: string[] }
    | { type: "error"; message: string };

export class LivePreviewBridge {
    public static attach(projectData: RawProjectData, source: EngineSingletons): Promise<void> {
        const client = (window as unknown as { FLINT_LIVE_PREVIEW?: LivePreviewConnection }).FLINT_LIVE_PREVIEW;
        if (!client) {
            throw new Error("Live preview is not available");
        }

        const assets = projectData.assets;
        const remaining = new Map(assets.map(asset => [asset.id, asset] as [string, AssetMeta]));

        let resolvePromise: (() => void) | undefined;
        const promise = assets.length > 0
            ? new Promise<void>(resolve => {
                resolvePromise = resolve;
            })
            : Promise.resolve();

        client.onData((data) => {
            if (typeof data !== "object" || data === null) {
                return;
            }

            const message = data as LivePreviewMessage;

            if (message.type === "asset") {
                const asset = remaining.get(message.id);
                if (!asset) {
                    return;
                }

                asset.url = URL.createObjectURL(new Blob([message.data]));
                remaining.delete(message.id);

                if (remaining.size === 0) {
                    resolvePromise?.();
                }
            }
            else if (message.type === "hot-reload") {
                void HotReloadBridge.apply(message.code, message.components, source);
            }
        });

        return promise;
    }
}
