export type UnsavedChoice = "save" | "discard" | "cancel";

export class UnsavedChangesDialog {
    private static dialog: HTMLElement & { show: () => void; hide: () => void; };
    private static saveBtn: HTMLElement;
    private static discardBtn: HTMLElement;
    private static cancelBtn: HTMLElement;
    private static resolveCallback: ((choice: UnsavedChoice) => void) | null = null;

    public static init() {
        UnsavedChangesDialog.dialog = document.getElementById("unsaved-changes-dialog") as HTMLElement & { show: () => void; hide: () => void; };
        UnsavedChangesDialog.saveBtn = document.getElementById("unsaved-save-btn")!;
        UnsavedChangesDialog.discardBtn = document.getElementById("unsaved-discard-btn")!;
        UnsavedChangesDialog.cancelBtn = document.getElementById("unsaved-cancel-btn")!;

        UnsavedChangesDialog.saveBtn.addEventListener("click", () => {
            UnsavedChangesDialog.resolveCallback?.("save");
            UnsavedChangesDialog.dialog.hide();
        });

        UnsavedChangesDialog.discardBtn.addEventListener("click", () => {
            UnsavedChangesDialog.resolveCallback?.("discard");
            UnsavedChangesDialog.dialog.hide();
        });

        UnsavedChangesDialog.cancelBtn.addEventListener("click", () => {
            UnsavedChangesDialog.resolveCallback?.("cancel");
            UnsavedChangesDialog.dialog.hide();
        });

        UnsavedChangesDialog.dialog.addEventListener("sl-request-close", (event: any) => {
            if (event.detail?.source === "overlay") {
                event.preventDefault();
            }
        });
    }

    public static async show(): Promise<UnsavedChoice> {
        return new Promise((resolve) => {
            UnsavedChangesDialog.resolveCallback = resolve;
            UnsavedChangesDialog.dialog.show();
        });
    }
}

