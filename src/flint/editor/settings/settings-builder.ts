import { CasingHandler } from "../casing-handler";
import type SlButton from "@shoelace-style/shoelace/dist/components/button/button.component.js";

export type SettingsSchema = {
    [name: string]: SettingsSchemaField | SettingsSchema;
};

type BaseField<TType extends string, TValue> = {
    type: TType;
    default?: TValue;
};

type NumberField = BaseField<"number", number> & {
    min?: number;
    max?: number;
};

type StringField = BaseField<"string", string>;

type BooleanField = BaseField<"boolean", boolean>;

type SelectField<T> = BaseField<"select", T> & {
    options: T[];
};

type ButtonField = BaseField<"button", never> & {
    buttonId: string;
    label?: string;
};

export type ButtonAction = (event: MouseEvent, button: SlButton) => void | Promise<void>;
export type ButtonActions = Record<string, ButtonAction>;

export type SettingsSchemaField<T = unknown> =
    | NumberField
    | StringField
    | BooleanField
    | SelectField<T>
    | ButtonField;


export class SettingsBuilder {
    private constructor() { }

    private static isField(obj: SettingsSchemaField | SettingsSchema): obj is SettingsSchemaField {
        return "type" in obj;
    }

    public static field(name: string, schema: SettingsSchemaField, buttonActions: ButtonActions) {
        function el(
            tag: string,
            assign?: Record<string, unknown>,
            children?: string | Node | (string | Node)[]
        ): HTMLElement {

            const element = Object.assign(
                document.createElement(tag),
                assign
            );

            if (children) {
                if (Array.isArray(children))
                    element.append(...children);
                else
                    element.append(children);
            }

            return element;
        }
        name = CasingHandler.splitPascalCase(name);

        switch (schema.type) {
            case "boolean":
                return el("sl-checkbox", {
                    checked: schema.default ?? false
                }, name);

            case "number":
                return el("sl-input", {
                    type: "number",
                    label: name,
                    value: schema.default?.toString() ?? ""
                });

            case "string":
                return el("sl-input", {
                    value: schema.default ?? "",
                    label: name
                });

            case "select": {
                const select = el("sl-select", {
                    hoist: true,
                    label: name,
                    value: String(schema.default).replaceAll(" ", "-")
                },
                    schema.options.map(opt => {
                        const option = el("sl-option", {
                            value: String(opt).replaceAll(" ", "-")
                        }, String(opt));

                        return option;
                    }
                    )
                ) as HTMLSelectElement;

                return select;
            }

            case "button": {
                const button = el("sl-button", {}, schema.label ?? name) as SlButton;

                const action = buttonActions[schema.buttonId];
                if (action) {
                    button.addEventListener("click", event => {
                        void action(event as MouseEvent, button);
                    });
                }
                else {
                    button.disabled = true;
                    button.title = `No action registered for buttonId "${schema.buttonId}"`;
                    console.warn(`No button action found for buttonId "${schema.buttonId}".`);
                }

                return button;
            }
        }
    }

    private static annotateSettingControl(element: HTMLElement, schema: SettingsSchemaField, path: string) {
        if (schema.type === "button") {
            return;
        }

        element.dataset.settingPath = path;
        element.dataset.settingType = schema.type;
    }

    private static buildRecursive(schema: SettingsSchema, parent: HTMLElement, buttonActions: ButtonActions, pathPrefix = "") {
        for (const key in schema) {
            const value = schema[key]!;
            const settingPath = pathPrefix ? `${pathPrefix}.${key}` : key;

            if (this.isField(value)) {
                const field = this.field(key, value, buttonActions);
                this.annotateSettingControl(field, value, settingPath);

                const div = document.createElement("div");
                div.append(field);

                parent.append(
                    div,
                    document.createElement("br")
                );
            }
            else {
                const fieldset = document.createElement("fieldset");
                const legend = document.createElement("legend");

                legend.textContent = key;

                fieldset.append(legend);

                this.buildRecursive(value, fieldset, buttonActions, settingPath);

                parent.append(fieldset);
            }
        }
    }

    public static build(schema: SettingsSchema, buttonActions: ButtonActions = {}, name?: string | undefined) {
        const form = document.createElement("form");

        this.buildRecursive(schema, form, buttonActions, name??"");

        return form;
    }
}
