export class AssetRegistry {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    private static assets = new Map<string, any>();

    private constructor() {}

    static has(id: string) {
        return this.assets.has(id);
    }

    static get<T>(id: string): T {
        return this.assets.get(id);
    }

    static set(id: string, asset: unknown) {
        this.assets.set(id, asset);
    }
}

export class AssetLoader {
    private constructor() {}

    static async loadImage(id: string, url: string) {
        const img = new Image();
        img.src = url;
        await img.decode();
        AssetRegistry.set(id, img);
        return img;
    }

    static async loadAudio(id: string, url: string, ctx: AudioContext) {
        const response = await fetch(url);
        const data = await response.arrayBuffer();
        const buffer = await ctx.decodeAudioData(data);
        AssetRegistry.set(id, buffer);
        return buffer;
    }

    static async loadJSON(id: string, url: string) {
        const data = await fetch(url).then(r => r.json());
        AssetRegistry.set(id, data);
        return data;
    }
}
