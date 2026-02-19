import type SlDialog from "@shoelace-style/shoelace/dist/components/dialog/dialog.component.js";
import type SlTab from "@shoelace-style/shoelace/dist/components/tab/tab.component.js";
import type SlTabPanel from "@shoelace-style/shoelace/dist/components/tab-panel/tab-panel.component.js";
import type SlTabGroup from "@shoelace-style/shoelace/dist/components/tab-group/tab-group.component.js";
import { SettingsBuilder, type SettingsSchema } from "./settings-builder";
import settingsSchema from "./settings-schema.json" with { type: 'json' };

export class SettingsWindow {
    private tabGroup: SlTabGroup;

    public constructor(private windowElement: SlDialog) {
        this.tabGroup = this.windowElement.querySelector("sl-tab-group")!;
        document.getElementById("project-settings-button")!.addEventListener("click", () => {
            this.windowElement.show();
        });

        this.buildTabs();
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



    private buildTabs() {
        for (const [name, schema] of Object.entries(settingsSchema)) {
            const capitalized = name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
            
            this.addTab(name, capitalized, SettingsBuilder.build(schema as SettingsSchema));
        }
    }
}