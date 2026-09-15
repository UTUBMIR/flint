import type SlButton from "@shoelace-style/shoelace/dist/components/button/button.js";

export type ExternalChangeChoice = "save" | "cancel";

export class ExternalChangeDialog {
    private static dialog: HTMLElement & { show: () => void; hide: () => void; };
    private static saveBtn: SlButton;
    private static cancelBtn: SlButton;
    private static resolveCallback: ((choice: ExternalChangeChoice) => void) | null = null;
    private static pending: Promise<ExternalChangeChoice> | null = null;
    private static countdownId: ReturnType<typeof setInterval> | null = null;

    private static readonly SAVE_DELAY_SECONDS = 5;

    public static init() {
        ExternalChangeDialog.dialog = document.getElementById("external-change-dialog") as HTMLElement & { show: () => void; hide: () => void; };
        ExternalChangeDialog.saveBtn = document.getElementById("external-change-save-btn") as SlButton;
        ExternalChangeDialog.cancelBtn = document.getElementById("external-change-cancel-btn") as SlButton;

        ExternalChangeDialog.saveBtn.addEventListener("click", () => {
            // Not clickable while disabled, but guard anyway.
            if (ExternalChangeDialog.saveBtn.disabled) return;
            ExternalChangeDialog.resolve("save");
        });

        ExternalChangeDialog.cancelBtn.addEventListener("click", () => {
            ExternalChangeDialog.resolve("cancel");
        });

        ExternalChangeDialog.dialog.addEventListener("sl-request-close", (event: Event) => {
            const source = (event as CustomEvent).detail?.source;
            if (source === "overlay") {
                event.preventDefault();
            }
        });
    }

    public static show(): Promise<ExternalChangeChoice> {
        const existing = ExternalChangeDialog.pending;
        if (existing) {
            return existing;
        }

        const created: Promise<ExternalChangeChoice> = new Promise<ExternalChangeChoice>((resolve) => {
            ExternalChangeDialog.resolveCallback = resolve;
            ExternalChangeDialog.resetSaveButton();
            ExternalChangeDialog.dialog.show();
        }).finally(() => {
            if (ExternalChangeDialog.pending === created) {
                ExternalChangeDialog.pending = null;
            }
        });

        ExternalChangeDialog.pending = created;
        return created;
    }

    private static resolve(choice: ExternalChangeChoice) {
        ExternalChangeDialog.stopCountdown();
        ExternalChangeDialog.resolveCallback?.(choice);
        ExternalChangeDialog.resolveCallback = null;
        ExternalChangeDialog.dialog.hide();
    }

    private static resetSaveButton() {
        ExternalChangeDialog.stopCountdown();

        let remaining = ExternalChangeDialog.SAVE_DELAY_SECONDS;
        ExternalChangeDialog.saveBtn.disabled = true;
        ExternalChangeDialog.updateSaveLabel(remaining);

        ExternalChangeDialog.countdownId = setInterval(() => {
            remaining -= 1;
            if (remaining <= 0) {
                ExternalChangeDialog.stopCountdown();
                ExternalChangeDialog.saveBtn.disabled = false;
                ExternalChangeDialog.saveBtn.textContent = "Save anyways";
            } else {
                ExternalChangeDialog.updateSaveLabel(remaining);
            }
        }, 1000);
    }

    private static updateSaveLabel(secondsLeft: number) {
        ExternalChangeDialog.saveBtn.textContent = `Save anyways (${secondsLeft})`;
    }

    private static stopCountdown() {
        if (ExternalChangeDialog.countdownId !== null) {
            clearInterval(ExternalChangeDialog.countdownId);
            ExternalChangeDialog.countdownId = null;
        }
    }
}
