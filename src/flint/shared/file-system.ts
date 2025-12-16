export abstract class AbstractFileSystem {
    protected rootHandle?: unknown;

    public get started(): boolean {
        return !!this.rootHandle;
    }

    public setRootHandle(handle: unknown): void {
        this.rootHandle = handle;
    }

    public static toArrayBuffer(data: Uint8Array): ArrayBuffer {
        return data.buffer instanceof ArrayBuffer
            ? data.buffer
            : data.slice().buffer;
    }

    private static decoder = new TextDecoder();
    private static encoder = new TextEncoder();

    public async readTextFile(path: string): Promise<string> {
        return AbstractFileSystem.decoder.decode(await this.readFile(path));
    }

    public async writeTextFile(path: string, data: string): Promise<void> {
        return this.writeFile(path, AbstractFileSystem.encoder.encode(data));
    }

    public abstract readFile(path: string): Promise<Uint8Array>;
    public abstract writeFile(path: string, data: Uint8Array): Promise<void>;
    public abstract exists(path: string): Promise<boolean>;
    public abstract delete(path: string): Promise<void>;
    public abstract listDir(path: string): Promise<string[]>;

    public abstract createDir(path: string): Promise<void>;
    public abstract deleteDir(path: string, recursive?: boolean): Promise<void>;
}


export class BrowserFileSystem extends AbstractFileSystem {
    protected declare rootHandle: FileSystemDirectoryHandle;

    public override setRootHandle(handle: FileSystemDirectoryHandle): void {
        this.rootHandle = handle;
    }

    public async createDir(path: string): Promise<void> {
        await this.getDirHandle(path);
    }

    public async deleteDir(path: string, recursive = false): Promise<void> {
        const { dir, name } = this.splitPath(path);
        const dirHandle = await this.getDirHandle(dir);
        await dirHandle.removeEntry(name, { recursive });
    }

    public async readFile(path: string): Promise<Uint8Array> {
        const fileHandle = await this.getFileHandle(path);
        const file = await fileHandle.getFile();
        return new Uint8Array(await file.arrayBuffer());
    }

    public async writeFile(path: string, data: Uint8Array): Promise<void> {
        const fileHandle = await this.getFileHandle(path, true);
        const writable = await fileHandle.createWritable();
        await writable.write(AbstractFileSystem.toArrayBuffer(data));
        await writable.close();
    }


    public async exists(path: string): Promise<boolean> {
        try {
            await this.getFileHandle(path);
            return true;
        } catch {
            return false;
        }
    }

    public async delete(path: string): Promise<void> {
        const { dir, name } = this.splitPath(path);
        const dirHandle = await this.getDirHandle(dir);
        await dirHandle.removeEntry(name);
    }

    public async listDir(path: string): Promise<string[]> {
        const dirHandle = await this.getDirHandle(path);
        const result: string[] = [];
        for await (const [name] of dirHandle.entries()) {
            result.push(name);
        }
        return result;
    }

    private async getFileHandle(path: string, create = false) {
        const { dir, name } = this.splitPath(path);
        const dirHandle = await this.getDirHandle(dir);
        return dirHandle.getFileHandle(name, { create });
    }

    private async getDirHandle(path: string) {
        let current = this.rootHandle;
        for (const part of path.split("/").filter(Boolean)) {
            current = await current.getDirectoryHandle(part, { create: true });
        }
        return current;
    }

    private splitPath(path: string) {
        const parts = path.split("/");
        return {
            dir: parts.slice(0, -1).join("/"),
            name: parts.at(-1)!
        };
    }
}

export class VirtualFileSystem extends AbstractFileSystem {
    private files = new Map<string, Uint8Array>();
    private folders = new Set<string>();

    async createDir(path: string): Promise<void> {
        this.folders.add(path.replace(/\/+$/, ""));
    }

    async deleteDir(path: string, recursive = false): Promise<void> {
        path = path.replace(/\/+$/, "");
        if (recursive) {
            // видаляємо всі файли і підпапки
            for (const key of [...this.files.keys()]) {
                if (key.startsWith(path + "/")) this.files.delete(key);
            }
            for (const key of [...this.folders]) {
                if (key.startsWith(path + "/")) this.folders.delete(key);
            }
        }
        this.folders.delete(path);
    }

    async listDir(path: string): Promise<string[]> {
        const prefix = path.endsWith("/") ? path : path + "/";
        const files = [...this.files.keys()]
            .filter(p => p.startsWith(prefix))
            .map(p => p.slice(prefix.length).split("/")[0]!);
        const dirs = [...this.folders]
            .filter(d => d.startsWith(prefix))
            .map(d => d.slice(prefix.length).split("/")[0]!);
        return Array.from(new Set([...files, ...dirs]));
    }

    async readFile(path: string): Promise<Uint8Array> {
        const data = this.files.get(path);
        if (!data) throw new Error("File not found: " + path);
        return data;
    }

    async writeFile(path: string, data: Uint8Array): Promise<void> {
        this.files.set(path, data);
    }

    async exists(path: string): Promise<boolean> {
        return this.files.has(path);
    }

    async delete(path: string): Promise<void> {
        this.files.delete(path);
    }
}