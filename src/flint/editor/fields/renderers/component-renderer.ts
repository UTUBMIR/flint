import { BaseDropRenderer } from "./base-drop-renderer";
import { System } from "../../../runtime/system";
import type Component from "../../../runtime/component";
import Metadata, { MetadataKeys } from "../../../shared/metadata";

export class ComponentRenderer extends BaseDropRenderer<Component> {
    public canRender(type: string) {
        return type === "component";
    }

    protected parseDrop(dt: DataTransfer): Component | null {
        const parsed = JSON.parse(dt.getData("application/x-component-ref"));
        if (!parsed) return null;
        const compType = System.components.get(parsed.name);

        if (!compType) return null;

        return System.world.getGameObjectById(parsed.id)?.getComponent(compType) ?? null;
    }

    protected stringify(comp: Component | null): string {
        return comp ? `Component: ${this.getDisplayName(comp)}` : "Drop Component";
    }

    private getDisplayName(comp: Component): string {
        return Metadata.getClass(comp, MetadataKeys.EditorName)
            ?? System.getComponentName(comp);
    }
}
