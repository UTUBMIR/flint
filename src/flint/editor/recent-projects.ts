export class RecentProjectsAccess {
    private static db: IDBDatabase | null = null;

    private static readonly DB_NAME = "flint-editor";
    private static readonly STORE_NAME = "project-handles";
    private static readonly DB_VERSION = 1;

    private static async getDB(): Promise<IDBDatabase> {
        if (RecentProjectsAccess.db) {
            return RecentProjectsAccess.db;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(RecentProjectsAccess.DB_NAME, RecentProjectsAccess.DB_VERSION);

            request.onerror = () => reject(request.error);

            request.onsuccess = () => {
                RecentProjectsAccess.db = request.result;
                resolve(RecentProjectsAccess.db);
            };

            request.onupgradeneeded = (event) => {
                const db = (event.target as IDBOpenDBRequest).result;
                if (!db.objectStoreNames.contains(RecentProjectsAccess.STORE_NAME)) {
                    db.createObjectStore(RecentProjectsAccess.STORE_NAME, { keyPath: "id" });
                }
            };
        });
    }

    private static async saveProject(projectId: string, name: string, handle: FileSystemDirectoryHandle): Promise<void> {
        const db = await this.getDB();

        const entry = {
            id: projectId,
            name: name,
            lastOpened: Date.now(),
            handle: handle
        };

        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(RecentProjectsAccess.STORE_NAME, "readwrite");
            const store = transaction.objectStore(RecentProjectsAccess.STORE_NAME);
            const request = store.put(entry);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    public static async openProject(projectId: string): Promise<FileSystemDirectoryHandle | null> {
        const db = await this.getDB();

        const entry = await new Promise<{ id: string; name: string; lastOpened: number; handle: FileSystemDirectoryHandle } | undefined>((resolve, reject) => {
            const transaction = db.transaction(RecentProjectsAccess.STORE_NAME, "readonly");
            const store = transaction.objectStore(RecentProjectsAccess.STORE_NAME);
            const request = store.get(projectId);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve(request.result);
        });

        if (!entry?.handle) {
            return null;
        }

        const handle = entry.handle;

        if (typeof handle.queryPermission !== "function") {
            return handle;
        }

        try {
            const permission = await handle.queryPermission({ mode: "readwrite" });
            if (permission === "granted") {
                return handle;
            }
        } catch {
            // Handle might be stale
        }

        try {
            const result = await handle.requestPermission({ mode: "readwrite" });
            if (result === "granted") {
                return handle;
            }
            return null;
        } catch (e) {
            if ((e as Error).name === "NotAllowedError") {
                return null;
            }
            throw e;
        }
    }

    public static async storeHandle(handle: FileSystemDirectoryHandle): Promise<void> {
        await this.saveProject(handle.name, handle.name, handle);
    }

    public static async remove(projectId: string): Promise<void> {
        const db = await this.getDB();

        await new Promise<void>((resolve, reject) => {
            const transaction = db.transaction(RecentProjectsAccess.STORE_NAME, "readwrite");
            const store = transaction.objectStore(RecentProjectsAccess.STORE_NAME);
            const request = store.delete(projectId);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => resolve();
        });
    }

    public static async getAll(): Promise<Array<{ id: string; name: string; lastOpened: number }>> {
        const db = await this.getDB();

        return new Promise((resolve, reject) => {
            const transaction = db.transaction(RecentProjectsAccess.STORE_NAME, "readonly");
            const store = transaction.objectStore(RecentProjectsAccess.STORE_NAME);
            const request = store.getAll();

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                const results = request.result as Array<{ id: string; name: string; lastOpened: number }>;
                results.sort((a, b) => b.lastOpened - a.lastOpened);
                resolve(results.slice(0, 10));
            };
        });
    }
}