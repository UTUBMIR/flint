import fs from "node:fs";
import path from "node:path";
import {
    addAsset,
    assetTypeFromNumber,
    assetTypeNames,
    listAssets,
    removeAsset,
    renameAsset,
    type AssetTypeName,
    type RawProjectData
} from "@flint/build";

function loadProject(projectDir: string): { path: string; data: RawProjectData } {
    const projectDirAbs = path.resolve(projectDir);
    const projectPath = path.join(projectDirAbs, "project.json");

    if (!fs.existsSync(projectPath)) {
        throw new Error(`No project.json found in ${projectDirAbs}. Is this a flint project?`);
    }

    return {
        path: projectPath,
        data: JSON.parse(fs.readFileSync(projectPath, "utf8")) as RawProjectData
    };
}

function saveProject(project: { path: string; data: RawProjectData }): void {
    fs.writeFileSync(project.path, JSON.stringify(project.data, null, 4));
}

function printAssets(assets: RawProjectData["assets"]): void {
    if (assets.length === 0) {
        console.log("No assets registered.");
        return;
    }

    for (const asset of assets) {
        console.log(`${asset.id}\t${assetTypeFromNumber(asset.type)}\t${asset.preload ? "preload" : "-"}\t${asset.url}`);
    }
}

function parseTypeName(value: string | undefined): AssetTypeName {
    if (!value) return "image";

    if (!assetTypeNames.includes(value as AssetTypeName)) {
        throw new Error(`Unknown asset type: ${value}. Expected one of: ${assetTypeNames.join(", ")}.`);
    }

    return value as AssetTypeName;
}

export async function assetCommand(args: string[], defaultDir: string): Promise<void> {
    const subcommand = args[0];
    if (!subcommand) {
        throw new Error("Usage: flint asset <list|add|remove|rename> [args] [--dir <dir>]");
    }

    let projectDir = defaultDir;
    let valueArgs: string[] = [];
    let preload = false;
    let typeName: AssetTypeName = "image";

    for (let i = 1; i < args.length; i++) {
        const arg = args[i]!;

        if (arg === "--dir") {
            projectDir = args[++i]!;
        } else if (arg === "--preload") {
            preload = true;
        } else if (arg === "--type") {
            typeName = parseTypeName(args[++i]);
        } else if (arg.startsWith("-")) {
            throw new Error(`Unknown option: ${arg}`);
        } else {
            valueArgs.push(arg);
        }
    }

    const project = loadProject(projectDir);

    switch (subcommand) {
        case "list":
            printAssets(listAssets(project.data));
            break;

        case "add": {
            const url = valueArgs[0];
            if (!url) throw new Error("Usage: flint asset add <url> [--type <type>] [--preload] [--dir <dir>]");

            const asset = addAsset(project.data, { url, type: typeName, preload });
            saveProject(project);
            console.log(`Registered asset ${asset.id} (${typeName}${preload ? ", preload" : ""}): ${url}`);
            break;
        }

        case "remove": {
            const selector = valueArgs[0];
            if (!selector) throw new Error("Usage: flint asset remove <id|url> [--dir <dir>]");

            const removed = removeAsset(project.data, selector);
            if (!removed) throw new Error(`Asset not found: ${selector}`);

            saveProject(project);
            console.log(`Removed asset ${removed.id}: ${removed.url}`);
            break;
        }

        case "rename": {
            const [selector, newUrl] = valueArgs;
            if (!selector || !newUrl) throw new Error("Usage: flint asset rename <id|url> <newUrl> [--dir <dir>]");

            const renamed = renameAsset(project.data, selector, newUrl);
            if (!renamed) throw new Error(`Asset not found: ${selector}`);

            saveProject(project);
            console.log(`Renamed asset ${renamed.id}: ${renamed.url}`);
            break;
        }

        default:
            throw new Error(`Unknown asset command: ${subcommand}. Expected one of: list, add, remove, rename.`);
    }
}
