import type Component from "./component";
import Metadata, { MetadataKeys } from "../shared/metadata";
import { System } from "./system";

export class HotReload {
    private constructor() { }

    /**
     * @deprecated This method breaks existing references, and is not recommended to use.
     * 
     * Creates a new instance while saving field values of the old one.
     * 
     * Prefer {@link HotReload.reloadComponent}.
     */
    public static swapClass<T extends Component>(component: Component, newType: new () => T): T {
        const newObject = new newType();

        for (const key of Object.keys(component)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (newObject as any)[key] = (component as any)[key];
        }

        return newObject;
    }

    /**
     * Replace the registered component constructor and retarget all live
     * instances so instanceof checks and method dispatch use the new class.
     */
    public static reloadComponent(name: string, componentType: typeof Component): void {
        const previousType = System.components.get(name);
        System.components.set(name, componentType);

        if (Metadata.enabled && Metadata.getClass(componentType.prototype, MetadataKeys.EditorName, false) === undefined) {
            Metadata.setClass(componentType.prototype, MetadataKeys.EditorName, name);
        }

        if (!previousType?.prototype) {
            return;
        }

        for (const layer of System.world.getLayers()) {
            for (const object of layer.getObjects()) {
                const instance = object.getComponent(previousType);
                if (!instance) {
                    continue;
                }

                Object.setPrototypeOf(instance, componentType.prototype);
            }
        }
    }
}
