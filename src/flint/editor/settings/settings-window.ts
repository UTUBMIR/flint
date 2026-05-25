import type SlDialog from "@shoelace-style/shoelace/dist/components/dialog/dialog.component.js";
import type SlTab from "@shoelace-style/shoelace/dist/components/tab/tab.component.js";
import type SlTabPanel from "@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.component.js";
import type SlTabGroup from "@shoelace-style/shoelace/dist/components/tab-group/tab-group.component.js";
import { SettingsBuilder, type ButtonActions, type SettingsSchema } from "./settings-builder";
import settingsSchema from "./settings-schema.json" with { type: 'json' };
import Editor from "../editor";
import { Notifier } from "../notifier";
import { Project } from "../project/project";

export const enum ButtonId {
    UpdateFlintTypes = "updateFlintTypes"
}

async function updateFlintFiles() {
    try {
        Editor.loadingDialogProgressBar.value = 0;
        Editor.loadingDialogProgressBar.indeterminate = false;
        Editor.loadingDialog.show();

        await Project.loadFlintTypes();

        Notifier.notify("Flint types updated successfully.", "success");
    }
    catch (e: unknown) {
        Notifier.notify("Could not update Flint types: " + e, "warning");
    }
    finally {
        Editor.loadingDialog.hide();
    }
}

const defaultButtonActions: Record<ButtonId, () => void> = {
    [ButtonId.UpdateFlintTypes]: updateFlintFiles
};

export type SettingsValue = string | number | boolean | null;
export type SettingsObject = {
    [key: string]: SettingsValue | SettingsObject;
};

export type SettingsChangedEventDetail = {
    path: string;
    value: SettingsValue;
    settings: SettingsObject;
};

export class SettingsWindow {
    public static readonly SettingsChangedEventName = "settings-changed";

    private tabGroup: SlTabGroup;
    private readonly changeListeners = new Set<(event: SettingsChangedEventDetail) => void>();

    public constructor(private windowElement: SlDialog, private readonly buttonActions: ButtonActions = defaultButtonActions) {
        this.tabGroup = this.windowElement.querySelector("sl-tab-group")!;
        document.getElementById("project-settings-button")!.addEventListener("click", () => {
            this.windowElement.show();
        });

        this.buildTabs();
        this.bindSettingsEvents();
    }

    public addTab(id: string, title: string, content: Node) {
        const tabElement = document.createElement("sl-tab") as SlTab;
        tabElement.slot = "nav";
        tabElement.panel = id;
        tabElement.textContent = title;

        const tabPanelElement = document.createElement("sl-tab-panel") as SlTabPanel;
        tabPanelElement.name = id;
        tabPanelElement.append(content);

        this.tabGroup.append(tabElement, tabPanelElement);
    }

    public getSettings(): SettingsObject {
        const settings: SettingsObject = {};
        const controls = this.tabGroup.querySelectorAll<HTMLElement>("[data-setting-path]");

        for (const control of controls) {
            const path = control.dataset.settingPath;
            if (!path) {
                continue;
            }

            const value = this.getControlValue(control);
            this.setValueByPath(settings, path, value);
        }

        return settings;
    }

    public onSettingsChanged(listener: (event: SettingsChangedEventDetail) => void): () => void {
        this.changeListeners.add(listener);
        return () => {
            this.changeListeners.delete(listener);
        };
    }

    public setSettingValue(path: string, value: SettingsValue): boolean {
        const control = this.findControlByPath(path);
        if (!control) {
            return false;
        }

        const type = control.dataset.settingType;
        if (!type) {
            return false;
        }

        if (type === "boolean") {
            (control as HTMLInputElement).checked = Boolean(value);
            return true;
        }

        const nextValue = value === null ? "" : String(value);
        (control as HTMLInputElement).value =
            type === "select" ? nextValue.replaceAll(" ", "-") : nextValue;

        return true;
    }


    private buildTabs() {
        for (const [name, schema] of Object.entries(settingsSchema)) {
            const capitalized = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();

            this.addTab(name, capitalized, SettingsBuilder.build(schema as SettingsSchema, this.buttonActions, name));
        }
    }

    private bindSettingsEvents() {
        const controls = this.tabGroup.querySelectorAll<HTMLElement>("[data-setting-path]");
        for (const control of controls) {
            control.addEventListener("sl-change", () => {
                const path = control.dataset.settingPath;
                if (!path) {
                    return;
                }

                const detail: SettingsChangedEventDetail = {
                    path,
                    value: this.getControlValue(control),
                    settings: this.getSettings()
                };

                for (const listener of this.changeListeners) {
                    listener(detail);
                }

                this.windowElement.dispatchEvent(new CustomEvent<SettingsChangedEventDetail>(
                    SettingsWindow.SettingsChangedEventName,
                    { detail }
                ));
            });
        }
    }

    private findControlByPath(path: string) {
        return Array.from(this.tabGroup.querySelectorAll<HTMLElement>("[data-setting-path]"))
            .find(control => control.dataset.settingPath === path);
    }

    private getControlValue(control: HTMLElement): SettingsValue {
        const type = control.dataset.settingType;
        if (!type) {
            return null;
        }

        if (type === "boolean") {
            return Boolean((control as HTMLInputElement).checked);
        }

        const rawValue = (control as HTMLInputElement).value ?? "";
        if (type === "number") {
            const parsed = Number(rawValue);
            return Number.isFinite(parsed) ? parsed : null;
        }

        return rawValue;
    }

    private setValueByPath(target: SettingsObject, path: string, value: SettingsValue) {
        const keys = path.split(".");
        let current: SettingsObject = target;

        for (let i = 0; i < keys.length - 1; i++) {
            const key = keys[i]!;
            const existing = current[key];
            if (typeof existing === "object" && existing !== null && !Array.isArray(existing)) {
                current = existing;
                continue;
            }

            const next: SettingsObject = {};
            current[key] = next;
            current = next;
        }

        current[keys[keys.length - 1]!] = value;
    }
}
