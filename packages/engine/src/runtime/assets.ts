import { AbstractFileSystem } from "@flint/shared/file-system";
import { System, type UUID } from "./system";

export enum AssetType {
    Custom = -1,
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
    public constructor(
        public readonly id: UUID,
        public data: T
    ) { }
}

export class AssetHandle<T> {
    public constructor(public readonly id: UUID = crypto.randomUUID()) { }

    public get value() {
        return AssetRegistry.getRuntime<T>(this.id);
    }

    public get() {
        const asset = AssetRegistry.getRuntime<T>(this.id);
        if (!asset) {
            throw new Error(`Asset is not loaded: ${this.id}`);
        }
        return asset;
    }

    public request() {
        return AssetRequestSystem.request(this.id);
    }
}


export class AssetRegistry {
    public static meta = new Map<UUID, AssetMeta>();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public static runtime = new Map<UUID, RuntimeAsset<any>>();

    private constructor() { }

    public static register(meta: AssetMeta) {
        this.meta.set(meta.id, meta);
    }

    public static hasRuntime(id: UUID) {
        return this.runtime.has(id);
    }

    public static getRuntime<T>(id: UUID): T | undefined {
        return this.runtime.get(id)?.data;
    }

    public static serialize(): AssetMeta[] {
        return [...this.meta.values()];
    }

    public static loadSerialized(data: AssetMeta[]) {
        this.meta.clear();

        const incomingIds = new Set(data.map(a => a.id));

        for (const [id] of this.runtime) {
            if (!incomingIds.has(id)) {
                this.runtime.delete(id);
            }
        }

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

    public static async load(meta: AssetMeta) {
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
            case AssetType.Custom:
                await this.loadCustom(meta);
                break;
            default:
                meta.type satisfies never;
        }
    }

    private static async prepareUrl(url: string) {
        function isAbsolute(url: string): boolean {
            return url.indexOf('://') > 0 || url.indexOf('//') === 0;
        }

        if (!System.fileSystem || isAbsolute(url)) {
            return url;
        }
        else {
            const data = await System.fileSystem.readFile("build/" + url);
            const blob = new Blob([AbstractFileSystem.toArrayBuffer(data)]);
            // create object url from blob
            return URL.createObjectURL(blob);
        }
    }

    private static createAssetLoader(fetchAsset: (URL: string) => unknown) {
        return async (meta: AssetMeta) => {
            const url = await this.prepareUrl(meta.url);

            const assetData = await fetchAsset(url);

            AssetRegistry.runtime.set(meta.id, new RuntimeAsset(meta.id, assetData));
        };
    }

    private static loadImage = this.createAssetLoader(async (url: string) => {
        const img = new Image();
        img.src = url;
        await img.decode();

        return await createImageBitmap(img);
    });

    private static loadAudio = this.createAssetLoader(async (url: string) => {
        const res = await fetch(url);
        const data = await res.arrayBuffer();
        return await System.audioContext.decodeAudioData(data);
    });

    private static loadJson = this.createAssetLoader(async (url: string) => {
        return await fetch(url).then(r => r.json());
    });

    private static loadCustom = this.createAssetLoader(async (url: string) => await fetch(url));
}

export class AssetRequestSystem {
    private static pending = new Map<UUID, Promise<void>>();

    private constructor() { }

    public static request(id: UUID) {
        if (AssetRegistry.hasRuntime(id)) return;
        if (this.pending.has(id)) return;

        const meta = AssetRegistry.meta.get(id);
        if (!meta) {
            throw new Error(`Asset meta not found: ${id}`);
        }

        const promise = AssetLoader.load(meta).finally(() => {
            this.pending.delete(id);
        });

        this.pending.set(id, promise);
        return promise;
    }

    public static async waitAll() {
        const current = Array.from(this.pending.values());
        await Promise.all(current);
    }
}
