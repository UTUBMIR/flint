import Peer, { type DataConnection } from "peerjs";

export class PreviewClient {
    private peer?: Peer;
    private connection?: DataConnection;

    private buffer: unknown[] = [];
    private listeners: ((data: unknown) => void)[] = [];

    public get running(): boolean {
        return !!this.peer?.id;
    }

    public constructor() { }

    public start() {
        this.peer = new Peer(); // NOTE: Default constructor connects to PeerJs-Cloud
    }

    public async waitForRunning() {
        return new Promise((resolve, reject) => {
            if (!this.peer) throw new ReferenceError("Peer must be started first");
            this.peer.on('open', (id) => {
                resolve(id);
            });
            this.peer.on('error', (e) => {
                reject(e);
            });
        });
    }

    public connect(id: string) {
        const connection = this.peer?.connect(id);

        if (connection) {
            this.connection = connection;

            connection.on("error", error => {
                console.error("Live preview connection error:", error);
            });

            connection.on("data", data => {
                this.buffer.push(data);
                for (const listener of this.listeners) {
                    listener(data);
                }
            });
        }
        else {
            console.error("Failed to create a connection to:", id);
        }
        return connection;
    }

    public onData(callback: (data: unknown) => void) {
        if (!this.connection) throw new ReferenceError("Connection must be started first");
        this.listeners.push(callback);
        for (const data of this.buffer) {
            callback(data);
        }
    }

    public clearBuffer() {
        this.buffer = [];
    }
}
