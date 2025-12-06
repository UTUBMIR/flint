/* eslint-disable @typescript-eslint/no-explicit-any */
import Vector2D from "../shared/vector2d";
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

function serializeValue(value: any): any {
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(serializeValue);

    const result: any = { __class__: value.constructor.name };
    for (const [key, val] of Object.entries(value)) {
        if (key === "parent") continue;
        result[key] = serializeValue(val);
    }
    return result;
}

function deserializeValue(value: any): any {
    if (value === null || typeof value !== "object") return value;
    if (Array.isArray(value)) return value.map(deserializeValue);

    let obj: any = value;
    if (value.__class__) {
        const Cls = System.components.get(value.__class__);
        if (Cls) {
            obj = Object.create(Cls.prototype);
        } else if (value.__class__ === "Transform") {
            obj = new Transform();
        }
        else if (value.__class__ === "Vector2D") {
            obj = new Vector2D();

        } else {
            console.warn(`Class ${value.__class__} not found`);
            obj = {};
        }
    }

    for (const [key, val] of Object.entries(value)) {
        if (key === "__class__") continue;
        obj[key] = deserializeValue(val);
    }

    return obj;
}

export class ProjectLoader {
    private constructor() { }

    public static serialize(data: ProjectData): string {
        const raw: RawProjectData = { layers: [] };

        for (const layer of data.layers) {
            const rawLayer: { objects: { uuid: UUID, components: { name: string, data: any }[] }[] } = { objects: [] };

            for (const obj of layer.getObjects()) {
                const rawObject: { uuid: UUID, components: { name: string, data: any }[] } = { uuid: obj.uuid as UUID, components: [] };

                for (const comp of [obj.transform, ...obj.getAllComponents()]) {
                    rawObject.components.push({
                        name: comp.constructor.name,
                        data: serializeValue(comp)
                    });
                }

                rawLayer.objects.push(rawObject);
            }

            raw.layers.push(rawLayer);
        }

        return JSON.stringify(raw);
    }

    public static deserialize(data: string): ProjectData {
        const raw = JSON.parse(data) as RawProjectData;
        const parsed: ProjectData = { layers: [] };

        for (const layer of raw.layers) {
            const gameLayer = new Layer();

            for (const obj of layer.objects) {
                let transform: Transform;
                const components: Component[] = [];

                for (const comp of obj.components) {
                    let cmp: any;
                    if (comp.name === "Transform") {
                        cmp = new Transform();
                    } else {
                        const CompClass = System.components.get(comp.name);
                        if (!CompClass) {
                            console.warn(`Component with name ${comp.name} not found in system registry.`);
                            continue;
                        }
                        cmp = Object.create(CompClass.prototype);
                    }

                    Object.assign(cmp, deserializeValue(comp.data));

                    if (cmp instanceof Transform) transform = cmp;
                    else components.push(cmp);
                }

                const go = new GameObject(components, transform!, obj.uuid);
                gameLayer.addObject(go);
            }

            parsed.layers.push(gameLayer);
        }

        return parsed;
    }


    public static load(project: ProjectData): void {
        for (const layer of project.layers) {
            System.pushLayer(layer);
        }
    }
}