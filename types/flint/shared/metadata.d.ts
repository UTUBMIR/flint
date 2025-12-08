export default class Metadata {
    private static classMeta;
    private static fieldMeta;
    static enabled: boolean;
    private static folderHandle;
    static setClass(target: object, key: string, value: any): void;
    static getClass(target: object, key: string): any;
    static setField(target: object, field: string, key: string, value: any): void;
    static getField(target: object, field: string, key: string): any;
    static getFieldAll(target: object, field: string): Map<string, any> | null;
    static importFrom(other: typeof Metadata): void;
    private static changed;
    static saveToFile(_folderHandle: FileSystemDirectoryHandle): Promise<void>;
    static loadFromFile(_folderHandle: FileSystemDirectoryHandle): Promise<void>;
}
