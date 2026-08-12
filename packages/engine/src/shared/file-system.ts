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

    public static bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
        if (a.length !== b.length) {
            return false;
        }
        for (let i = 0; i < a.length; ++i) {
            if (a[i] !== b[i]) {
                return false;
            }
        }
        return true;
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
    public abstract fileExists(path: string): Promise<boolean>;
    public abstract dirExists(path: string): Promise<boolean>;
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

    public getRootHandle(): FileSystemDirectoryHandle | undefined {
        return this.rootHandle;
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
        if (await this.fileMatches(path, data)) {
            return;
        }
        const fileHandle = await this.getFileHandle(path, true);
        const writable = await fileHandle.createWritable();
        await writable.write(AbstractFileSystem.toArrayBuffer(data));
        await writable.close();
    }

    private async fileMatches(path: string, data: Uint8Array): Promise<boolean> {
        try {
            const fileHandle = await this.getFileHandle(path);
            const file = await fileHandle.getFile();
            if (file.size !== data.length) {
                return false;
            }
            const existing = new Uint8Array(await file.arrayBuffer());
            return AbstractFileSystem.bytesEqual(existing, data);
        } catch {
            return false;
        }
    }


    public async fileExists(path: string): Promise<boolean> {
        try {
            await this.getFileHandle(path);
            return true;
        } catch {
            return false;
        }
    }

    public async dirExists(path: string): Promise<boolean> {
        try {
            await this.getDirHandle(path, false);
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
        const { dir, name } = this.splitPath(path); // filename is `name`
        const dirHandle = await this.getDirHandle(dir); // only directories
        return dirHandle.getFileHandle(name, { create });
    }

    private async getDirHandle(path: string, create = true) {
        let current = this.rootHandle;
        for (const part of path.split("/").filter(Boolean)) {
            current = await current.getDirectoryHandle(part, { create }); // only directories
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

    public async createDir(path: string): Promise<void> {
        this.folders.add(path.replace(/\/+$/, ""));
    }

    public async deleteDir(path: string, recursive = false): Promise<void> {
        path = path.replace(/\/+$/, "");
        if (recursive) {
            for (const key of [...this.files.keys()]) {
                if (key.startsWith(path + "/")) this.files.delete(key);
            }
            for (const key of [...this.folders]) {
                if (key.startsWith(path + "/")) this.folders.delete(key);
            }
        }
        this.folders.delete(path);
    }

    public async listDir(path: string): Promise<string[]> {
        const prefix = path.endsWith("/") ? path : path + "/";
        const files = [...this.files.keys()]
            .filter(p => p.startsWith(prefix))
            .map(p => p.slice(prefix.length).split("/")[0]!);
        const dirs = [...this.folders]
            .filter(d => d.startsWith(prefix))
            .map(d => d.slice(prefix.length).split("/")[0]!);
        return Array.from(new Set([...files, ...dirs]));
    }

    public async readFile(path: string): Promise<Uint8Array> {
        const data = this.files.get(path);
        if (!data) throw new Error("File not found: " + path);
        return data;
    }

    public async writeFile(path: string, data: Uint8Array): Promise<void> {
        this.files.set(path, data);
    }

    public async fileExists(path: string): Promise<boolean> {
        return this.files.has(path);
    }

    public async dirExists(path: string): Promise<boolean> {
        return this.folders.has(path);
    }

    public async delete(path: string): Promise<void> {
        this.files.delete(path);
    }
}
