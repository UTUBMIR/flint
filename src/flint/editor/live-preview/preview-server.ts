import type SlDialog from "@shoelace-style/shoelace/dist/components/dialog/dialog.component.js";
import type SlQrCode from "@shoelace-style/shoelace/dist/components/qr-code/qr-code.component.js";
import Peer, { type DataConnection } from "peerjs";
import { Builder } from "../project/builder";
import ProjectConfig from "../project/project-config";
import { Notifier } from "../notifier";
import { AssetRegistry } from "@flint/runtime/assets";
import { AbstractFileSystem } from "@flint/shared/file-system";
import { System } from "@flint/runtime/system";
import type { RawProjectData } from "@flint/runtime/project-loader";

type CompiledGame = { code: string; project: RawProjectData };

export class PreviewServer {
    private peer?: Peer;

    private connections: DataConnection[] = [];

    private compiledGame: CompiledGame | null | undefined;
    private compilePromise?: Promise<CompiledGame | null> | undefined;

    private codeLabel: HTMLElement;
    private qrCode: SlQrCode;
    private statusLabel: HTMLElement;

    public get running(): boolean {
        return !!this.peer?.id;
    }

    public constructor(private qrWindow: SlDialog) {
        this.codeLabel = this.qrWindow.getElementsByTagName("code")![0] as HTMLElement;
        this.qrCode = this.qrWindow.getElementsByTagName("sl-qr-code")![0] as SlQrCode;
        this.statusLabel = document.getElementById("live-preview-status")!;

        document.getElementById("live-preview-button")!.addEventListener("click", () => {
            this.qrWindow.show();
            if (!this.running) {
                this.start();
            }
        });

        document.getElementById("live-preview-update-button")!.addEventListener("click", () => {
            void this.pushUpdate();
        });
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

    private start() {
        this.peer = new Peer(); // NOTE: Default constructor connects to PeerJs-Cloud

        this.peer.on("open", id => {
            const url = `${window.location.origin}${window.location.pathname}?live_id=${id}`;

            this.codeLabel.textContent = url;

            this.qrCode.style.display = "flex"; // NOTE: Show QR code
            this.qrCode.value = url;
        });

        this.peer.on("connection", conn => {
            this.connections.push(conn);
            conn.on("open", () => {
                this.setStatus(`${this.connections.length} client(s) connected`);
                void this.sendGame(conn);
            });

            conn.on("close", () => {
                this.connections.splice(this.connections.indexOf(conn), 1);
                this.setStatus(`${this.connections.length} client(s) connected`);
            });
        });
    }

    public async pushUpdate() {
        if (!this.running) {
            this.start();
            try {
                await this.waitForRunning();
            }
            catch {
                this.setStatus("Could not start the preview server.");
                return;
            }
        }

        this.compiledGame = undefined;

        if (!await Builder.buildForEditor(true)) {
            this.setStatus("Compilation failed. Update not sent.");
            return;
        }

        this.broadcast({
            type: "hot-reload",
            code: Builder.compiledCode,
            components: ProjectConfig.config.components.map(c => c.name)
        });

        this.setStatus(`Update sent to ${this.connections.length} client(s).`);
        Notifier.notify("Update sent to live preview.", "success");
    }

    private async getCompiledGame(): Promise<CompiledGame | null> {
        if (this.compiledGame !== undefined) {
            return this.compiledGame;
        }
        if (!this.compilePromise) {
            this.compilePromise = this.doCompile().finally(() => {
                this.compilePromise = undefined;
            });
        }
        return this.compilePromise;
    }

    private async doCompile(): Promise<CompiledGame | null> {
        this.setStatus("Compiling the project...");
        try {
            const result = await Builder.compileLive();
            this.compiledGame = result;
            if (!result) {
                this.setStatus("Compilation failed. Open a project first.");
            }
            return result;
        }
        catch (error) {
            console.error("Live preview compilation failed:", error);
            this.compiledGame = null;
            this.setStatus("Compilation failed.");
            return null;
        }
    }

    private async sendGame(conn: DataConnection) {
        const result = await this.getCompiledGame();
        if (!result) {
            conn.send({ type: "error", message: "Compilation failed. Open a project first." });
            return;
        }

        conn.send({ type: "start", code: result.code });

        for (const meta of AssetRegistry.meta.values()) {
            try {
                const data = await System.fileSystem.readFile("build/" + meta.url);
                conn.send({ type: "asset", id: meta.id, data: AbstractFileSystem.toArrayBuffer(data) });
            }
            catch (error) {
                console.warn(`Failed to send asset "${meta.url}":`, error);
            }
        }

        this.setStatus(`Game sent to ${this.connections.length} client(s).`);
    }

    private setStatus(text: string) {
        this.statusLabel.textContent = text;
    }

    public broadcast(data: unknown) {
        for (const conn of this.connections) {
            conn.send(data);
        }
    }
}
