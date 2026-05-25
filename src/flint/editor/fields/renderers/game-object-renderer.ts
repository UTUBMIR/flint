import { BaseDropRenderer } from "./base-drop-renderer";
import type GameObject from "@flint/runtime/game-object";
import { System, type UUID } from "@flint/runtime/system";
import Metadata, { MetadataKeys } from "@flint/shared/metadata";

export class GameObjectRenderer extends BaseDropRenderer<GameObject> {
    public canRender(type: string) {
        return type === "gameobject";
    }

    protected parseDrop(dt: DataTransfer): GameObject | null {
        const id = dt.getData("application/x-gameobject-id");
        if (!id) return null;

        return System.world.getGameObjectById(id as UUID) ?? null;
    }

    protected stringify(go: GameObject | null): string {
        return go ? `GameObject: ${Metadata.getClass(go, MetadataKeys.EditorName)}` : "Drop GameObject";
    }
}
