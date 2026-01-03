/* eslint-disable @typescript-eslint/no-explicit-any */
import Metadata, { MetadataKeys } from "../shared/metadata";
import { AssetRegistry, AssetRequestSystem, type AssetMeta } from "./assets";
import Component from "./component";
import GameObject from "./game-object";
import Layer from "./layer";
import StrongRef from "./strong-ref";
import { System, type UUID } from "./system";
import Transform from "./transform";

export enum LoadPhase {
    Create,
    Deserialize,
    Resolve,
    PostLoad
}

export type RawProjectData = {
    layers: {
        objects: {
            uuid: UUID;
            components: { name: string; data: any }[];
        }[];
    }[];
    assets: AssetMeta[];
};

export type ProjectData = {
    layers: Layer[];
    assets: AssetMeta[];
};

export class LoadContext {
    layers = new Map<number, Layer>();
    objects = new Map<UUID, GameObject>();
}

class LoadScheduler {
    private tasks = new Map<LoadPhase, (() => void)[]>();

    add(phase: LoadPhase, task: () => void) {
        if (!this.tasks.has(phase)) this.tasks.set(phase, []);
        this.tasks.get(phase)!.push(task);
    }

    run() {
        for (const phase of [
            LoadPhase.Create,
            LoadPhase.Deserialize,
            LoadPhase.Resolve,
            LoadPhase.PostLoad
        ]) {
            for (const task of this.tasks.get(phase) ?? []) {
                task();
            }
        }
    }
}

type DeserializePlugin<T> = {
    type: abstract new () => T;
    phase: LoadPhase;
    deserialize(dataRef: StrongRef<any>, instance: T, ctx: LoadContext): void;
};

type SerializePlugin<T> = {
    type: abstract new () => T;
    serialize(value: T): any;
};

function hasSameShape(
    value: any,
    template: any,
    strict = false
): boolean {
    if (!value || !template) return false;
    if (typeof value !== "object" || typeof template !== "object") return false;

    const valueKeys = Object.keys(value);
    const templateKeys = Object.keys(template);

    if (strict && valueKeys.length !== templateKeys.length) {
        return false;
    }

    for (const key of templateKeys) {
        if (!(key in value)) return false;

        const v = value[key];
        const t = template[key];

        if (v == null || t == null) continue;

        if (typeof v !== typeof t) return false;
    }

    return true;
}


class LoaderPlugins {
    private static serialize = new Map<(abstract new () => any), SerializePlugin<any>>();
    private static deserialize = new Map<(abstract new () => any), DeserializePlugin<any>>();

    static addSerialize<T>(plugin: SerializePlugin<T>) {
        this.serialize.set(plugin.type, plugin);
    }

    static addDeserialize<T>(plugin: DeserializePlugin<T>) {
        this.deserialize.set(plugin.type, plugin);
    }

    static getSerializeByType(type: (abstract new () => any)) {
        return this.serialize.get(type);
    }

    static getSerializeByShape(
        value: any,
        strict = false
    ): SerializePlugin<any> | undefined {
        if (!value || typeof value !== "object") return;

        for (const plugin of LoaderPlugins.serialize.values()) {
            const TemplateType = plugin.type;
            let template: any;

            try {
                template = new (TemplateType as any)();
            } catch {
                continue;
            }

            if (hasSameShape(value, template, strict)) {
                return plugin;
            }
        }

        return;
    }


    static getDeserializeByShape(
        value: any,
        strict = false
    ): DeserializePlugin<any> | undefined {
        if (!value || typeof value !== "object") return;

        for (const plugin of LoaderPlugins.deserialize.values()) {
            const TemplateType = plugin.type;
            let template: any;

            try {
                template = new (TemplateType as any)();
            } catch {
                continue;
            }

            if (hasSameShape(value, template, strict)) {
                return plugin;
            }
        }

        return;
    }

    static getDeserializeByType(type: abstract new () => any) {
        let ctor: any = type;

        while (ctor) {
            const plugin = this.deserialize.get(ctor);
            if (plugin) return plugin;

            ctor = Object.getPrototypeOf(ctor);
        }

        return;
    }
}

function restorePrototypesDeep(
    loaded: StrongRef<any>,
    template: any,
    useModules: boolean = true
): void {
    if (!loaded.value || !template) return;

    // 1. trying plugin
    if (useModules) {
        const plugin = LoaderPlugins.getDeserializeByShape(template);
        if (plugin && plugin.phase === LoadPhase.Deserialize) {
            const restored = new (template.constructor as any)();
            plugin.deserialize(loaded, restored, ProjectLoader.context ?? new LoadContext()); // TODO: Set current context as argument
            return;
        }
    }

    // 2. restoring by fallback
    for (const key of Object.keys(loaded.value)) {
        const lVal = loaded.value[key];
        const tVal = template[key];

        if (!lVal || !tVal) continue;
        if (typeof lVal !== "object" || typeof tVal !== "object") continue;

        if (Array.isArray(lVal) && Array.isArray(tVal)) {
            const tItem = tVal[0];
            if (!tItem) continue;

            for (let i = 0; i < lVal.length; i++) {
                const item = lVal[i];
                if (!item || typeof item !== "object") continue;

                const itemPlugin = LoaderPlugins.getDeserializeByShape(tItem);
                if (itemPlugin && itemPlugin.phase === LoadPhase.Deserialize) {
                    const restoredItem = new (tItem.constructor as any)();
                    itemPlugin.deserialize(new StrongRef(lVal, i), restoredItem, ProjectLoader.context ?? new LoadContext());
                } else {
                    Object.setPrototypeOf(item, Object.getPrototypeOf(tItem));
                    restorePrototypesDeep(new StrongRef(lVal, i), tItem, true);
                }
            }
            continue;
        }

        const fieldPlugin = LoaderPlugins.getDeserializeByShape(tVal);
        if (fieldPlugin && fieldPlugin.phase === LoadPhase.Deserialize) {
            const restoredField = new (tVal.constructor as any)();
            fieldPlugin.deserialize(new StrongRef(loaded.value, key), restoredField, ProjectLoader.context ?? new LoadContext());
        } else {
            Object.setPrototypeOf(lVal, Object.getPrototypeOf(tVal));
            restorePrototypesDeep(new StrongRef(loaded.value, key), tVal, true);
        }
    }
}



export class ProjectLoader {
    private constructor() { }

    private static _context: LoadContext | undefined;
    public static get context(): LoadContext | undefined {
        return ProjectLoader._context;
    }

    public static deserialize(raw: RawProjectData): ProjectData {
        const ctx = new LoadContext();
        ProjectLoader._context = ctx;
        const scheduler = new LoadScheduler();

        const result: ProjectData = {
            layers: [],
            assets: raw.assets
        };

        // Create: layers + objects
        raw.layers.forEach((rawLayer, layerIndex) => {
            const layer = new Layer();
            ctx.layers.set(layerIndex, layer);
            result.layers.push(layer);

            for (const rawObj of rawLayer.objects) {
                const go = new GameObject([], undefined, rawObj.uuid);
                ctx.objects.set(rawObj.uuid, go);

                scheduler.add(LoadPhase.Resolve, () => {
                    layer.addObject(go);
                });
            }
        });

        // components
        raw.layers.forEach(rawLayer => {
            for (const rawObj of rawLayer.objects) {
                const go = ctx.objects.get(rawObj.uuid)!;

                for (const rawComp of rawObj.components) {
                    const CompClass =
                        System.components.get(rawComp.name) ??
                        (rawComp.name === "Transform" ? Transform : undefined);

                    if (!CompClass) {
                        console.warn(`Component "${rawComp.name}" not registered.`);
                        continue;
                    }

                    const instance = new (CompClass as any)();

                    scheduler.add(LoadPhase.Create, () => {
                        if (instance instanceof Transform) {
                            restorePrototypesDeep(
                                new StrongRef(rawComp, "data"),
                                instance,
                                false
                            );
                            Object.assign(go.transform, rawComp.data);
                        } else {
                            go.addComponent(instance);
                        }
                    });

                    scheduler.add(LoadPhase.Deserialize, () => {
                        restorePrototypesDeep(
                            new StrongRef(rawComp, "data"),
                            instance,
                            false
                        );

                        Object.assign(instance, rawComp.data);
                    });


                    const plugin = LoaderPlugins.getDeserializeByType(CompClass);
                    if (plugin) {
                        scheduler.add(plugin.phase, () => {
                            plugin.deserialize(new StrongRef(rawComp, "data"), instance, ctx);
                        });
                    }
                }
            }
        });

        scheduler.run();
        ProjectLoader._context = undefined;
        return result;
    }

    public static serialize(data: ProjectData): string {
        const raw: RawProjectData = {
            layers: [],
            assets: data.assets
        };

        for (const layer of data.layers) {
            const rawLayer = { objects: [] as any[] };

            for (const obj of layer.getObjects()) {
                const rawObject = {
                    uuid: obj.uuid as UUID,
                    components: [] as any[]
                };

                const components = [
                    obj.transform,
                    ...obj.getAllComponents()
                ];

                for (const comp of components) {
                    const rawComp = {
                        name: comp.constructor.name,
                        data: {} as any
                    };

                    for (const key of Object.keys(comp)) {
                        if (Metadata.getField(comp, key, MetadataKeys.NonSerialized)) continue;

                        const value = (comp as any)[key];
                        if (value === undefined) continue;

                        const plugin = LoaderPlugins.getSerializeByShape(value);
                        rawComp.data[key] = plugin
                            ? plugin.serialize(value)
                            : value;
                    }

                    rawObject.components.push(rawComp);
                }

                rawLayer.objects.push(rawObject);
            }

            raw.layers.push(rawLayer);
        }

        return JSON.stringify(raw);
    }

    public static async load(project: ProjectData) {
        for (const layer of System.layers) {
            System.removeLayer(layer);
        }

        AssetRegistry.loadSerialized(project.assets);
        await AssetRequestSystem.waitAll();

        for (const layer of project.layers) {
            System.pushLayer(layer);
        }
    }
}


LoaderPlugins.addSerialize<GameObject>({
    type: GameObject,
    serialize(go: GameObject) {
        return {
            uuid: go.uuid
        };
    }
});

LoaderPlugins.addDeserialize<GameObject>({
    type: GameObject,
    phase: LoadPhase.Deserialize,
    deserialize(dataRef: StrongRef<any>, _restored: GameObject, ctx: LoadContext) {
        const existing = ctx.objects.get(dataRef.value.uuid);
        if (existing) {
            dataRef.value = existing;
        }
    }
});

LoaderPlugins.addSerialize<Component>({
    type: Component,
    serialize(comp: Component) {
        return {
            uuid: comp.gameObject?.uuid,
            component: comp.constructor.name
        };
    }
});

LoaderPlugins.addDeserialize<Component>({
    type: Component,
    phase: LoadPhase.Deserialize,
    deserialize(dataRef: StrongRef<any>, _instance: Component, ctx: LoadContext) {
        const existingObject = ctx.objects.get(dataRef.value.uuid);
        const existing = existingObject?.requireComponent(System.components.get(dataRef.value.component) as (typeof Component));

        dataRef.value = existing;
    }
});