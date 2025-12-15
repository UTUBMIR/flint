import { System, type UUID } from "./system";

export class Asset {
    public data: unknown;
}

export class ImageAsset extends Asset {
    public declare data: typeof Image;
}

export class AudioAsset extends Asset {
    public declare data: typeof AudioBuffer;
}

export class JsonAsset extends Asset {
    public declare data: typeof AudioBuffer;
}

export class AssetRegistry {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private static assets = new Map<UUID, any>();

    private constructor() {}

    public static has(id: UUID) {
        return this.assets.has(id);
    }

    public static get<T>(id: UUID): T {
        return this.assets.get(id);
    }

    public static set(id: UUID, asset: unknown) {
        this.assets.set(id, asset);
    }
}

export class AssetLoader {
    private constructor() {}

    public static async loadImage(id: UUID, url: string) {
        const img = new Image();
        img.src = url;
        await img.decode();
        AssetRegistry.set(id, img);
        return img;
    }

    public static async loadAudio(id: UUID, url: string, ctx: AudioContext) {
        const response = await fetch(url);
        const data = await response.arrayBuffer();
        const buffer = await ctx.decodeAudioData(data);
        AssetRegistry.set(id, buffer);
        return buffer;
    }

    public static async loadJSON(id: UUID, url: string) {
        const data = await fetch(url).then(r => r.json());
        AssetRegistry.set(id, data);
        return data;
    }
}

export class AssetRequestSystem {
    private static pending = new Set<string>();

    private constructor() {}

    public static requestAsset(id: UUID, url: string, type: "image" | "audio" | "json") {
        if (AssetRegistry.has(id)) return;

        if (!this.pending.has(id)) {
            this.pending.add(id);
            this.load(id, url, type);
        }
    }

    private static async load(id: UUID, url: string, type: string) {
        if (type === "image") await AssetLoader.loadImage(id, url);
        if (type === "audio") await AssetLoader.loadAudio(id, url, System.audioContext);
        if (type === "json") await AssetLoader.loadJSON(id, url);

        this.pending.delete(id);
        console.log(`Asset loaded during game: ${id}`);
    }
}
