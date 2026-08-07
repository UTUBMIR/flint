import { AssetRegistry, AssetRequestSystem } from "@flint/runtime/assets";
import type { UUID } from "@flint/runtime/system";
import { Project } from "../project/project";
import { Notifier } from "../notifier";

export type AutofixAction = {
    label: string;
    apply: () => void | Promise<void>;
};

export type AutofixFixContext = {
    message: string;
    groups: string[];
    stack?: string;
};

export type EngineErrorExplanation = {
    id: string;
    title: string;
    explanation: string;
    tips: string[];
    match: RegExp;
    matchStack?: RegExp;
    fix?: (context: AutofixFixContext) => AutofixAction[];
};

export type EngineErrorExplanationResult = {
    entry: EngineErrorExplanation;
    message: string;
    groups: string[];
    stack?: string;
};

export class EngineErrorExplanations {
    private static entries: EngineErrorExplanation[] = [];
    private static seeded = false;

    public static register(entry: EngineErrorExplanation): void {
        EngineErrorExplanations.ensureSeeded();
        EngineErrorExplanations.entries.push(entry);
    }

    public static find(message: string, stack?: string): EngineErrorExplanationResult | null {
        EngineErrorExplanations.ensureSeeded();

        for (const entry of EngineErrorExplanations.entries) {
            const match = message.match(entry.match);
            if (!match) {
                continue;
            }
            if (entry.matchStack && !(stack && entry.matchStack.test(stack))) {
                continue;
            }

            const result: EngineErrorExplanationResult = { entry, message, groups: match.slice(1) };
            if (stack !== undefined) {
                result.stack = stack;
            }
            return result;
        }

        return null;
    }

    private static ensureSeeded(): void {
        if (EngineErrorExplanations.seeded) {
            return;
        }
        EngineErrorExplanations.seeded = true;
        EngineErrorExplanations.seedBuiltins();
    }

    private static seedBuiltins(): void {
        EngineErrorExplanations.entries.push(
            {
                id: "required-component-not-found",
                title: "Missing required component",
                explanation: "A game object tried to use a component that is not attached to it. `requireComponent()` is used when a script must have another component on the same object to work.",
                tips: [
                    "Select the object in the Hierarchy and add the missing component in the Inspector.",
                    "Make sure the component is attached before this script's start() runs.",
                    "If the object is created in code, add the component first (e.g. object.addComponent(...))."
                ],
                match: /^Required component \S+ was not found\./
            },
            {
                id: "input-axis-not-found",
                title: "Input axis not found",
                explanation: "The game is reading the input axis \"{1}\", which has not been set up. The axis name must match one defined in the project's input settings.",
                tips: [
                    "Check the exact spelling of the axis name.",
                    "Define the axis in the project's input settings, or use an existing axis."
                ],
                match: /^InputAxis with name (\S+) does not exist!/
            },
            {
                id: "asset-meta-not-found",
                title: "Asset not found",
                explanation: "The code references an asset that does not exist in the project, or its id does not match. This often happens with an empty or stale asset reference.",
                tips: [
                    "Re-import the asset, or set the asset reference again in the Inspector.",
                    "Make sure the asset id matches one in the Assets panel."
                ],
                match: /^Asset meta not found: \S+/
            },
            {
                id: "asset-not-loaded",
                title: "Asset is not loaded yet",
                explanation: "The asset \"{1}\" was requested before it finished loading, or it could not be loaded.",
                tips: [
                    "Use the asset only after it has loaded (e.g. in start(), not in the constructor).",
                    "Request it explicitly first with asset.request(), or enable preloading in the project."
                ],
                match: /^Asset is not loaded: (\S+)/,
                fix: context => {
                    const [assetId] = context.groups;
                    const meta = assetId ? AssetRegistry.meta.get(assetId as UUID) : undefined;

                    if (!meta) {
                        return [];
                    }
                    if (meta.preload) {
                        return [];
                    }

                    return [
                        {
                            label: `Load "${meta.url.replace(/^assets\//, "")}" on game start (set preload)`,
                            apply: async () => {
                                meta.preload = true;
                                await Project.saveProject();
                                AssetRequestSystem.request(meta.id);
                                Notifier.notify("Preload enabled. The asset will be loaded before the game starts.", "success");
                            }
                        }
                    ];
                }
            },
            {
                id: "asset-load-failure",
                title: "Asset file could not be loaded",
                explanation: "The game tried to read the file \"{1}\" for this asset, but the file is missing at that path.",
                tips: [
                    "Make sure the file exists under the project's assets/ folder.",
                    "Re-import the file if it was renamed, moved, or deleted.",
                    "Check that the asset url points to an existing file."
                ],
                match: /^Failed to load asset "([^"]+)" \(([0-9a-f-]+)\)/
            },
            {
                id: "file-not-found",
                title: "File not found",
                explanation: "The game tried to read the file \"{1}\", but it does not exist at that path.",
                tips: [
                    "Check the path spelling.",
                    "Make sure the file was imported into the project."
                ],
                match: /^File not found: (\S+)/
            },
            {
                id: "2d-context-not-found",
                title: "Rendering context not available",
                explanation: "The game could not get the 2D canvas rendering context it needs to draw.",
                tips: [
                    "Make sure a canvas is available before the game starts.",
                    "Check the viewport / renderer configuration."
                ],
                match: /2D rendering context was not found!|Failed to get 2D context/
            },
            // {
            //     id: "metadata-decorator-private-field",
            //     title: "Decorator on a private field",
            //     explanation: "Field decorators (@Field and similar) cannot be used on private fields.",
            //     tips: [
            //         "Make the field public, or remove the decorator."
            //     ],
            //     match: /Metadata decorators do not support private fields\./
            // },
            {
                id: "metadata-decorator-field-name",
                title: "Decorator field name missing",
                explanation: "A metadata decorator was used without a field name string.",
                tips: [
                    "Pass the field name as a string to the decorator."
                ],
                match: /Metadata decorators require a string field name\./
            },
            {
                id: "metadata-disabled",
                title: "Metadata is disabled",
                explanation: "You are using metadata-dependent features while metadata support is turned off.",
                tips: [
                    "Enable metadata in the project settings."
                ],
                match: /Metadata is disabled/
            }
        );
    }
}

export function interpolateExplanation(text: string, groups: string[]): string {
    return text.replace(/\{(\d+)\}/g, (_, index: string) => {
        return groups[Number(index)] ?? "?";
    });
}
