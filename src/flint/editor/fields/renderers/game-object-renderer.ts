import { BaseDropRenderer } from "./base-drop-renderer";
import type GameObject from "../../../runtime/game-object";
import { System, type UUID } from "../../../runtime/system";
import Metadata, { MetadataKeys } from "../../../shared/metadata";

export class GameObjectDropRenderer extends BaseDropRenderer<GameObject> {
    canRender(type: string) {
        return type === "gameobject";
    }

    protected parseDrop(dt: DataTransfer): GameObject | null {
        const id = dt.getData("application/x-gameobject-id");
        if (!id) return null;

        return System.getGameObjectById(id as UUID)??null;
    }

    protected stringify(go: GameObject | null): string {
        return go ? `GameObject: ${Metadata.getClass(go, MetadataKeys.EditorName)}` : "Drop GameObject";
    }
}
