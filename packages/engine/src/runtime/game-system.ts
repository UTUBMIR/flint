import type { World } from "./world";

export abstract class GameSystem {
    protected world!: World;
    public enabled = true;
    public readonly order: number = 0;

    public init(world: World): void {
        this.world = world;
        this.onInit();
    }

    public destroy(): void {
        this.onDestroy();
    }

    public update(): void {
        if (this.enabled) this.onUpdate();
    }

    public render(): void { }

    protected onInit(): void { }
    protected onDestroy(): void { }
    protected onUpdate(): void { }
}
