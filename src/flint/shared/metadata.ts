/* eslint-disable @typescript-eslint/no-explicit-any */
import type Layer from "../runtime/layer";
import { System, type UUID } from "../runtime/system";

export const MetadataKeys = {
    NonSerialized: Symbol.for("shared.non-serialized"),
    FieldRenderer: Symbol.for("editor.field-renderer"),
    HideInInspector: Symbol.for("editor.hide-in-inspector"),
    EditorName: Symbol.for("editor.editor-name")
};

/**
 * Turns off serialization for field.
 */
export function NonSerialized() {
    return (target: any, key: string) => {
        metadataRequest(() => {
            Metadata.setField(target, key, MetadataKeys.NonSerialized, true);
        });
    };
}


// function deserializeMap(arr: any[]): Map<any, any> {
//     return new Map(
//         arr.map(([key, value]) => {
//             if (Array.isArray(value)) {
//                 return [key, deserializeMap(value)];
//             }
//             return [key, value];
//         })
//     );
// }

// function serializeMap(map: Map<any, any>): any[] {
//     return Array.from(map.entries()).map(([key, value]) => {
//         if (value instanceof Map) {
//             return [key, serializeMap(value)];
//         }
//         return [key, value];
//     });
// }

type SaveType = {
    layers: {
        id: UUID;
        editorName?: string;
        objects: {
            id: UUID, editorName?: string;
        }[]
    }[]
};

export function metadataRequest(func: (() => void)) {
    if (Metadata && Metadata.enabled) {
        func();
    }
    // else {
    //     // pendingMetadata.push();
    // }
}

// const pendingMetadata: (() => void)[] = [];

// const pendingMetadataHandler = {
//   get(target, prop, receiver) {
//     return "world";
//   },
// };

// const proxy2 = new Proxy(target, handler2);

export default class Metadata {
    private static classMeta = new Map<object, Map<any, any>>();
    private static fieldMeta = new Map<object, Map<string, Map<any, any>>>();
    public static enabled = true;

    public static setClass(target: object, key: any, value: any) {
        if (!Metadata.enabled) throw new Error("Metadata is disabled");
        let map = this.classMeta.get(target);
        if (!map) {
            map = new Map();
            this.classMeta.set(target, map);
        }
        map.set(key, value);
        this.changed();
    }

    public static getClass(target: object, key: any, checkPrototypes = true) {
        let proto: any = target;
        while (proto) {
            const value = this.classMeta.get(proto)?.get(key);
            if (value !== undefined) return value;
            if (checkPrototypes) {
                proto = Object.getPrototypeOf(proto);
            }
            else {
                return undefined;
            }
        }
        return undefined;
    }

    public static setField(target: object, field: string, key: any, value: any) {
        if (!Metadata.enabled) throw new Error("Metadata is disabled");
        let fields = this.fieldMeta.get(target);
        if (!fields) {
            fields = new Map();
            this.fieldMeta.set(target, fields);
        }
        let meta = fields.get(field);
        if (!meta) {
            meta = new Map();
            fields.set(field, meta);
        }
        meta.set(key, value);
        this.changed();
    }

    public static getField(target: object, field: string, key: any) {
        let proto: any = target;
        while (proto) {
            const fields = this.fieldMeta.get(proto);
            const meta = fields?.get(field);
            if (meta?.has(key)) return meta.get(key);
            proto = Object.getPrototypeOf(proto);
        }
        return undefined;
    }

    public static getFieldAll(target: object, field: string) {
        let proto: any = target;
        while (proto) {
            const fields = this.fieldMeta.get(proto);
            const meta = fields?.get(field);
            if (meta) return meta;
            proto = Object.getPrototypeOf(proto);
        }
        return null;
    }


    public static importFrom(other: typeof Metadata) {
        for (const [target, map] of (other as any).classMeta) {
            let ownMap = this.classMeta.get(target);
            if (!ownMap) {
                ownMap = new Map();
                this.classMeta.set(target, ownMap);
            }
            for (const [key, value] of map) {
                ownMap.set(key, value);
            }
        }

        for (const [target, fields] of (other as any).fieldMeta) {
            let ownFields = this.fieldMeta.get(target);
            if (!ownFields) {
                ownFields = new Map();
                this.fieldMeta.set(target, ownFields);
            }
            for (const [field, meta] of fields) {
                let ownMeta = ownFields.get(field);
                if (!ownMeta) {
                    ownMeta = new Map();
                    ownFields.set(field, ownMeta);
                }
                for (const [key, value] of meta) {
                    ownMeta.set(key, value);
                }
            }
        }
        this.changed();
    }

    private static changed() {

    }

    public static async saveToFile(layers: Layer[]) {
        const save: SaveType = { layers: [] };

        for (const layer of layers) {
            const objects: { id: UUID, editorName: string }[] = [];

            for (const go of layer.getObjects()) {
                const editorName = Metadata.getClass(go, MetadataKeys.EditorName, false);
                if (editorName) {
                    objects.push({
                        id: go.id,
                        editorName: editorName
                    });
                }
            }
            const rawLayer = { id: layer.id, objects };
            const layerEditorName = Metadata.getClass(layer, MetadataKeys.EditorName, false);

            if (layerEditorName) {
                (rawLayer as any).editorName = layerEditorName;
            }

            save.layers.push(rawLayer as any);
        }
        await System.fileSystem.writeTextFile("metadata.json", JSON.stringify(save));
    }

    public static async loadFromFile() {
        if (!await System.fileSystem.fileExists("metadata.json")) {
            return;
        }

        const save = JSON.parse(await System.fileSystem.readTextFile("metadata.json")) as SaveType;

        for (const layer of save.layers) {
            const foundLayer = System.world.getLayers().find(l => l.id === layer.id);
            if (layer.id && foundLayer && layer.editorName !== undefined) {
                Metadata.setClass(foundLayer, MetadataKeys.EditorName, layer.editorName);
            }

            for (const object of layer.objects) {
                const go = System.world.getGameObjectById(object.id);
                if (go && object.editorName !== undefined) {
                    Metadata.setClass(go, MetadataKeys.EditorName, object.editorName);
                }
            }
        }
    }
}
