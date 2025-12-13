export declare const MetadataKeys: {
    NonSerialized: symbol;
    FieldRenderer: symbol;
    HideInInspector: symbol;
    EditorName: symbol;
};
/**
 * Turns off serialization for field.
 */
export declare function NonSerialized(): (target: any, key: string) => void;
export default class Metadata {
    private static classMeta;
    private static fieldMeta;
    static enabled: boolean;
    private static folderHandle;
    static setClass(target: object, key: any, value: any): void;
    static getClass(target: object, key: any): any;
    static setField(target: object, field: string, key: any, value: any): void;
    static getField(target: object, field: string, key: any): any;
    static getFieldAll(target: object, field: string): Map<any, any> | null;
    static importFrom(other: typeof Metadata): void;
    private static changed;
    static saveToFile(_folderHandle: FileSystemDirectoryHandle): Promise<void>;
    static loadFromFile(_folderHandle: FileSystemDirectoryHandle): Promise<void>;
}
