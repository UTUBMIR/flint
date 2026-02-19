import { ComponentBuilder } from "../component-builder";

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

export type SettingsSchemaField<T = unknown> =
    | NumberField
    | StringField
    | BooleanField
    | SelectField<T>;


export class SettingsBuilder {
    private constructor() { }

    private static isField(obj: SettingsSchemaField | SettingsSchema): obj is SettingsSchemaField {
        return "type" in obj;
    }

    public static field(name: string, schema: SettingsSchemaField) {
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
        name = ComponentBuilder.splitPascalCase(name);

        switch (schema.type) {
            case "boolean":
                return el("sl-checkbox", {
                    checked: schema.default ?? false
                }, name);

            case "number":
                return el("sl-input", {
                    type: "number",
                    label: name
                });

            case "string":
                return el("sl-input", {
                    checked: schema.default ?? false,
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
        }
    }

    private static buildRecursive(schema: SettingsSchema, parent: HTMLElement) {
        for (const key in schema) {
            const value = schema[key]!;

            if (this.isField(value)) {
                const div = document.createElement("div");
                div.append(this.field(key, value));

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

                this.buildRecursive(value, fieldset);

                parent.append(fieldset);
            }
        }
    }

    public static build(schema: SettingsSchema) {
        const form = document.createElement("form");

        this.buildRecursive(schema, form);

        return form;
    }
}