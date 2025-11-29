/* eslint-disable @typescript-eslint/no-explicit-any */
export default class Metadata {
    private static readonly classMeta = new Map<object, Map<string, any>>();
    private static readonly fieldMeta = new Map<object, Map<string, Map<string, any>>>();
    public static enabled = true;


    public static setClass(target: object, key: string, value: any) {
        if (!Metadata.enabled) return;
        let map = this.classMeta.get(target);
        if (!map) {
            map = new Map();
            this.classMeta.set(target, map);
        }
        map.set(key, value);
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
        if (!Metadata.enabled) return;
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
    }
}