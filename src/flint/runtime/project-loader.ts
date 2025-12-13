/* eslint-disable @typescript-eslint/no-explicit-any */
import Metadata, { MetadataKeys } from "../shared/metadata";
import type Component from "./component";
import GameObject from "./game-object";
import Layer from "./layer";
import { System, type UUID } from "./system";
import Transform from "./transform";

export type RawProjectData = {
    layers: { objects: { uuid: UUID, components: { name: string, data: any }[] }[] }[];
};

export type ProjectData = {
    layers: Layer[];
};

function restorePrototypesDeep(loaded: any, template: any): void {
    if (!loaded || !template) return;

    for (const key of Object.keys(loaded)) {
        const lVal = loaded[key];
        const tVal = template[key];

        if (tVal == null || typeof tVal !== "object") continue;
        if (lVal == null || typeof lVal !== "object") continue;

        // Case 1: Arrays
        if (Array.isArray(lVal) && Array.isArray(tVal)) {
            for (let i = 0; i < lVal.length; i++) {
                const lItem = lVal[i];
                const tItem = tVal[0]; // template for array item

                if (lItem && typeof lItem === "object" && tItem && typeof tItem === "object") {
                    Object.setPrototypeOf(
                        lItem,
                        Object.getPrototypeOf(tItem)
                    );
                    restorePrototypesDeep(lItem, tItem);
                }
            }
            continue;
        }

        // Case 2: Plain object
        Object.setPrototypeOf(
            lVal,
            Object.getPrototypeOf(tVal)
        );

        restorePrototypesDeep(lVal, tVal);
    }
}


export class ProjectLoader {
    private constructor() { }

    public static deserialize(data: string): ProjectData {
        const raw = JSON.parse(data) as RawProjectData;
        const parsed: ProjectData = { layers: [] };

        for (const layer of raw.layers) {
            const gameLayer = new Layer();

            for (const obj of layer.objects) {
                let transform: Transform | null = null;
                const components: Component[] = [];

                for (const comp of obj.components) {
                    const CompClass = System.components.get(comp.name) || (comp.name === "Transform" ? Transform : undefined);

                    if (!CompClass) {
                        console.warn(`Component "${comp.name}" not registered.`);
                        continue;
                    }

                    const template: any = new (CompClass as any)();
                    const loaded: any = comp.data;

                    restorePrototypesDeep(loaded, template);

                    const instance: any = new (CompClass as any)();
                    Object.assign(instance, loaded);

                    if (instance instanceof Transform) transform = instance;
                    else components.push(instance);
                }

                const go = new GameObject(components, transform!, obj.uuid);
                gameLayer.addObject(go);
            }
            parsed.layers.push(gameLayer);
        }
        return parsed;
    }


    public static serialize(data: ProjectData): string {
        const raw: RawProjectData = { layers: [] };

        for (const layer of data.layers) {
            const rawLayer: { objects: { uuid: UUID, components: { name: string, data: any }[] }[] } = { objects: [] };
            for (const obj of layer.getObjects()) {
                const rawObject: { uuid: UUID, components: { name: string, data: any }[] } = { uuid: obj.uuid as UUID, components: [] };

                for (const comp of [obj.transform, ...obj.getAllComponents()]) {
                    const rawComp: { name: string, data: any } = { name: comp.constructor.name, data: {} };

                    for (const key of Object.keys(comp)) {
                        if (Metadata.getField(comp, key, MetadataKeys.NonSerialized)) continue; // to avoid circular reference
                        rawComp.data[key] = (comp as any)[key]; // TODO: Add an automated way to ignore fields (something like @noSerialize)
                    }
                    rawObject.components.push(rawComp);
                }
                rawLayer.objects.push(rawObject);
            }
            raw.layers.push(rawLayer);
        }
        return JSON.stringify(raw);
    }

    public static load(project: ProjectData): void {
        System.layers.length = 0;
        for (const layer of project.layers) {
            System.pushLayer(layer);
        }
    }
}