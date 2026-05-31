import type { AssetData } from "./asset-types";

export type PopoutComponentConfig = {
    componentType: string;
    instanceId: string;
    windowState?: Record<string, unknown>;
    title?: string;
};

export type CrossWindowMessage =
    | { type: "POPOUT_HANDSHAKE"; source: string; config?: PopoutComponentConfig }
    | { type: "POPOUT_READY"; source: string }
    | { type: "SELECTION_CHANGED"; selectedId: string | null }
    | { type: "ASSETS_CHANGED"; assets: AssetData[] }
    | { type: "ASSET_ADDED"; asset: AssetData }
    | { type: "ASSET_REMOVED"; path: string };

let channelInstance: CrossWindowChannel | null = null;

export class CrossWindowChannel {
    private channel: BroadcastChannel;
    private listeners = new Set<(msg: CrossWindowMessage) => void>();

    public constructor(name: string = "flint-editor") {
        this.channel = new BroadcastChannel(name);
        this.channel.onmessage = (event: MessageEvent<CrossWindowMessage>) => {
            for (const listener of this.listeners) {
                listener(event.data);
            }
        };
    }

    public send(msg: CrossWindowMessage): void {
        this.channel.postMessage(msg);
    }

    public subscribe(fn: (msg: CrossWindowMessage) => void): () => void {
        this.listeners.add(fn);
        return () => this.listeners.delete(fn);
    }

    public close(): void {
        this.channel.close();
        this.listeners.clear();
    }
}

export function getCrossWindowChannel(): CrossWindowChannel {
    if (!channelInstance) {
        channelInstance = new CrossWindowChannel();
    }
    return channelInstance;
}
