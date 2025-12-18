import { System, type UUID } from "./system";

export enum AssetType {
    Image,
    Audio,
    Json
}

export interface AssetMeta {
    id: UUID;
    type: AssetType;
    url: string;
    preload: boolean;
}

export class RuntimeAsset<T> {
    constructor(
        public readonly id: UUID,
        public data: T
    ) { }
}

export class AssetHandle<T> {
    constructor(public readonly id: UUID = crypto.randomUUID()) { }

    public get() {
        return AssetRegistry.getRuntime<T>(this.id);
    }

    public request() {
        return AssetRequestSystem.request(this.id);
    }
}


export class AssetRegistry {
    static meta = new Map<UUID, AssetMeta>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    static runtime = new Map<UUID, RuntimeAsset<any>>();

    private constructor() { }

    static register(meta: AssetMeta) {
        this.meta.set(meta.id, meta);
    }

    static hasRuntime(id: UUID) {
        return this.runtime.has(id);
    }

    static getRuntime<T>(id: UUID): T | undefined {
        return this.runtime.get(id)?.data;
    }

    static serialize(): AssetMeta[] {
        return [...this.meta.values()];
    }

    static loadSerialized(data: AssetMeta[]) {
        this.meta.clear();
        this.runtime.clear();

        for (const asset of data) {
            this.meta.set(asset.id, asset);
            if (asset.preload) {
                AssetRequestSystem.request(asset.id);
            }
        }
    }
}

export class AssetLoader {
    private constructor() { }

    static async load(meta: AssetMeta) {
        switch (meta.type) {
            case AssetType.Image:
                await this.loadImage(meta);
                break;
            case AssetType.Audio:
                await this.loadAudio(meta);
                break;
            case AssetType.Json:
                await this.loadJson(meta);
                break;
        }
    }

    private static async loadImage(meta: AssetMeta) {
        const img = new Image();
        img.src = meta.url;
        await img.decode();

        const bitmap = await createImageBitmap(img);
        AssetRegistry.runtime.set(meta.id, new RuntimeAsset(meta.id, bitmap));
    }

    private static async loadAudio(meta: AssetMeta) {
        const res = await fetch(meta.url);
        const data = await res.arrayBuffer();
        const buffer = await System.audioContext.decodeAudioData(data);

        AssetRegistry.runtime.set(meta.id, new RuntimeAsset(meta.id, buffer));
    }

    private static async loadJson(meta: AssetMeta) {
        const json = await fetch(meta.url).then(r => r.json());
        AssetRegistry.runtime.set(meta.id, new RuntimeAsset(meta.id, json));
    }
}

export class AssetRequestSystem {
    private static pending = new Set<UUID>();

    private constructor() { }

    static request(id: UUID) {
        if (AssetRegistry.hasRuntime(id)) return;
        if (this.pending.has(id)) return;

        const meta = AssetRegistry.meta.get(id);
        if (!meta) {
            throw new Error(`Asset meta not found: ${id}`);
        }

        this.pending.add(id);

        return AssetLoader.load(meta).finally(() => {
            this.pending.delete(id);
        });
    }
}
