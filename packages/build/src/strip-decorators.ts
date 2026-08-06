export const editorDecoratorPattern =
    /^\s*@(HideInInspector|ShowInInspector|NonSerialized|FieldInspector|SelectInspector)(\s*\([^)]*\))?\s*$/gm;

function getInspectorMetadataImport(stripEditorDecorators: boolean): string {
    if (stripEditorDecorators) {
        return 'import { SerializeType as __FlintSerializeType } from "@flint/shared/metadata";';
    }
    return 'import { FieldInspector as __FlintFieldInspector, SelectInspector as __FlintSelectInspector, SerializeType as __FlintSerializeType } from "@flint/shared/metadata";';
}

export function transformSource(
    content: string,
    path: string,
    stripEditorDecorators: boolean,
    autoDetectInspectors = false
): string {
    if (!path.endsWith(".ts")) {
        return content;
    }

    let result: string;

    if (stripEditorDecorators) {
        const stripped = content.replace(editorDecoratorPattern, "");
        if (!autoDetectInspectors || path.endsWith(".d.ts")) {
            result = stripped;
        } else {
            result = addInferredSerializeTypeDecorators(stripped, stripEditorDecorators);
        }
    } else if (!autoDetectInspectors || path.endsWith(".d.ts")) {
        result = content;
    } else {
        result = addInferredInspectorDecorators(content, stripEditorDecorators);
    }

    return result;
}

function addInferredInspectorDecorators(content: string, stripEditorDecorators: boolean): string {
    const lines = content.split(/\r?\n/);
    const output: string[] = [];
    let changed = false;
    let decorators: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith("@")) {
            output.push(line);
            decorators.push(trimmed);
            continue;
        }

        const field = line.match(/^(\s*)(?:(public|protected)\s+)?([A-Za-z_$][\w$]*)([!?])?\s*:\s*([^=;]+)([=;].*)?$/);
        if (field) {
            const hasExplicitInspectorMetadata = decorators.some(decorator =>
                /^@(HideInInspector|NonSerialized|FieldInspector|SelectInspector|SerializeType)\b/.test(decorator)
            );

            if (!hasExplicitInspectorMetadata) {
                const indent = field[1] ?? "";
                const inferredDecorators: string[] = [];

                const inspectorDecorator = inferInspectorDecorator(field[5] ?? "");
                if (inspectorDecorator) {
                    inferredDecorators.push(inspectorDecorator);
                }

                const serializeTypeDecorator = inferSerializeTypeDecorator(field[5] ?? "");
                if (serializeTypeDecorator) {
                    inferredDecorators.push(serializeTypeDecorator);
                }

                if (inferredDecorators.length > 0) {
                    for (const decorator of inferredDecorators) {
                        output.push(`${indent}${decorator}`);
                    }
                    changed = true;
                }
            }

            output.push(line);
            decorators = [];
            continue;
        }

        output.push(line);

        if (trimmed.length > 0) {
            decorators = [];
        }
    }

    if (!changed) {
        return content;
    }

    return `${getInspectorMetadataImport(stripEditorDecorators)}\n${output.join("\n")}`;
}

function inferInspectorDecorator(typeAnnotation: string): string | null {
    const parts = splitUnionType(typeAnnotation)
        .map(part => part.trim())
        .filter(part => part !== "undefined" && part !== "null");

    if (parts.length === 0) {
        return null;
    }

    const selectOptions = parts.map(part => {
        const match = part.match(/^"([^"]*)"$/);
        return match?.[1];
    });

    if (selectOptions.every((option): option is string => option !== undefined)) {
        return `@__FlintSelectInspector(${JSON.stringify(selectOptions)})`;
    }

    if (parts.length !== 1) {
        return null;
    }

    const typeName = parts[0]!.replace(/^readonly\s+/, "");
    if (/(^|\.)Component$/.test(typeName)) {
        return '@__FlintFieldInspector("component")';
    }

    if (/(^|\.)GameObject$/.test(typeName)) {
        return '@__FlintFieldInspector("gameobject")';
    }

    return null;
}

function inferSerializeTypeDecorator(typeAnnotation: string): string | null {
    const parts = splitUnionType(typeAnnotation)
        .map(part => part.trim())
        .filter(part => part !== "undefined" && part !== "null");

    if (parts.length !== 1) {
        return null;
    }

    const typeName = parts[0]!.replace(/^readonly\s+/, "");

    // Match common serializable types
    if (/(^|\.)Vector2$/.test(typeName)) {
        return `@__FlintSerializeType(${typeName})`;
    }

    if (/(^|\.)Component$/.test(typeName)) {
        return `@__FlintSerializeType(${typeName})`;
    }

    if (/(^|\.)GameObject$/.test(typeName)) {
        return `@__FlintSerializeType(${typeName})`;
    }

    if (/(^|\.)Layer$/.test(typeName)) {
        return `@__FlintSerializeType(${typeName})`;
    }

    // For generic types like Map<K, V>, Store the constructor reference if it matches known serializable generics
    if (/^(Map|Set|Array)\s*</.test(typeName)) {
        return `@__FlintSerializeType(${typeName.split(/\s*</, 1)[0]})`;
    }

    return null;
}

function addInferredSerializeTypeDecorators(content: string, stripEditorDecorators: boolean): string {
    const lines = content.split(/\r?\n/);
    const output: string[] = [];
    let changed = false;
    let decorators: string[] = [];

    for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith("@")) {
            output.push(line);
            decorators.push(trimmed);
            continue;
        }

        const field = line.match(/^(\s*)(?:(public|protected)\s+)?([A-Za-z_$][\w$]*)([!?])?\s*:\s*([^=;]+)([=;].*)?$/);
        if (field) {
            const hasExplicitSerializeType = decorators.some(decorator =>
                /^@(SerializeType|NonSerialized)\b/.test(decorator)
            );

            if (!hasExplicitSerializeType) {
                const indent = field[1] ?? "";

                const serializeTypeDecorator = inferSerializeTypeDecorator(field[5] ?? "");
                if (serializeTypeDecorator) {
                    output.push(`${indent}${serializeTypeDecorator}`);
                    changed = true;
                }
            }

            output.push(line);
            decorators = [];
            continue;
        }

        output.push(line);

        if (trimmed.length > 0) {
            decorators = [];
        }
    }

    if (!changed) {
        return content;
    }

    return `${getInspectorMetadataImport(stripEditorDecorators)}\n${output.join("\n")}`;
}

function splitUnionType(typeAnnotation: string): string[] {
    return typeAnnotation
        .split("|")
        .map(part => part.trim())
        .filter(part => part.length > 0);
}
