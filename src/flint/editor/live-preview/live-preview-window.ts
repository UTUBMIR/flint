import { PreviewClient } from "./preview-client";
import type { LivePreviewMessage } from "@flint/runtime/live-preview-bridge";

export function initializeLivePreviewWindow(liveId: string): void {
    const rootDiv = document.createElement("div");
    rootDiv.id = "root";

    document.body.replaceChildren(rootDiv);

    const client = new PreviewClient();
    window.FLINT_LIVE_PREVIEW = client;

    let gameStarted = false;

    function showStatus(text: string) {
        let status = document.getElementById("live-preview-device-status");
        if (!status) {
            status = document.createElement("div");
            status.id = "live-preview-device-status";
            status.classList.add("live-preview-device-status");
            document.body.appendChild(status);
        }
        status.textContent = text;
    }

    async function loadGame(code: string) {
        if (gameStarted) {
            window.location.reload();
            return;
        }
        gameStarted = true;

        const blob = new Blob([code], { type: "text/javascript" });
        const url = URL.createObjectURL(blob);

        try {
            await import(url);
        }
        catch (error) {
            console.error("Failed to load the game:", error);
            showStatus("Failed to load the game");
            gameStarted = false;
        }
        finally {
            URL.revokeObjectURL(url);
            client.clearBuffer();
        }
    }

    client.start();
    client.waitForRunning().then(() => {
        const connection = client.connect(liveId);
        if (!connection) {
            showStatus("Failed to connect to the preview server.");
            return;
        }

        client.onData((data: unknown) => {
            if (typeof data !== "object" || data === null) {
                return;
            }

            const message = data as LivePreviewMessage;

            switch (message.type) {
                case "start":
                    void loadGame(message.code);
                    break;
                case "error":
                    console.error("Live preview error:", message.message);
                    showStatus(message.message);
                    break;
            }
        });
    }).catch(() => {
        showStatus("Could not start the preview client.");
    });
}
