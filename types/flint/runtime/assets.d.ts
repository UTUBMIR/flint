export declare class AssetRegistry {
    private static assets;
    private constructor();
    static has(id: string): boolean;
    static get<T>(id: string): T;
    static set(id: string, asset: unknown): void;
}
export declare class AssetLoader {
    private constructor();
    static loadImage(id: string, url: string): Promise<HTMLImageElement>;
    static loadAudio(id: string, url: string, ctx: AudioContext): Promise<AudioBuffer>;
    static loadJSON(id: string, url: string): Promise<any>;
}
