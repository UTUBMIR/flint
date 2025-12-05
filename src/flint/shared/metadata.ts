/* eslint-disable @typescript-eslint/no-explicit-any */
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


export default class Metadata {
    private static classMeta = new Map<object, Map<string, any>>();
    private static fieldMeta = new Map<object, Map<string, Map<string, any>>>();
    public static enabled = true;

    private static folderHandle: FileSystemDirectoryHandle | undefined = undefined;

    public static setClass(target: object, key: string, value: any) {
        if (!Metadata.enabled) throw new Error("Metadata is disabled");
        let map = this.classMeta.get(target);
        if (!map) {
            map = new Map();
            this.classMeta.set(target, map);
        }
        map.set(key, value);
        this.changed();
    }

    public static getClass(target: object, key: string) {
        let proto: any = target;
        while (proto) {
            const value = this.classMeta.get(proto)?.get(key);
            if (value !== undefined) return value;
            proto = Object.getPrototypeOf(proto);
        }
        return undefined;
    }

    public static setField(target: object, field: string, key: string, value: any) {
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

    public static getField(target: object, field: string, key: string) {
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
        if (this.folderHandle) {
            this.saveToFile(this.folderHandle);
        }
    }
    //TODO: make saving and loading of metadata when uuid system is ready
    public static async saveToFile(_folderHandle: FileSystemDirectoryHandle) {
        // const FileHandle = await folderHandle.getFileHandle("metadata.json", { create: true });
        // const Writable = await FileHandle.createWritable();

        // await Writable.write(JSON.stringify({
        //     classMeta: serializeMap(this.classMeta),
        //     fieldMeta: serializeMap(this.fieldMeta)
        // }, null, 4));

        // await Writable.close();
        // this.folderHandle = folderHandle;
    }

    public static async loadFromFile(_folderHandle: FileSystemDirectoryHandle) {
        // const FileHandle = await folderHandle.getFileHandle("metadata.json").catch(() => null);
        // if (!FileHandle) return;

        // const File = await FileHandle.getFile();
        // const content = await File.text();
        // const data = JSON.parse(content);

        // this.classMeta = deserializeMap(data.classMeta);
        // this.fieldMeta = deserializeMap(data.fieldMeta);

        // this.folderHandle = folderHandle;
    }

}