import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import {
    defaultProjectConfig,
    defaultProjectData,
    defaultProjectFiles,
    defaultTsConfig,
    minimalProjectData
} from "@flint/build";

const require = createRequire(import.meta.url);

function walkFiles(dir: string, baseDir: string, out: string[], ext: string[]): void {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            walkFiles(fullPath, baseDir, out, ext);
        } else if (entry.isFile()) {
            if (ext.some(e => entry.name.endsWith(e))) {
                out.push(path.relative(baseDir, fullPath).replace(/\\/g, "/"));
            }
        }
    }
}

function copyEngineTypes(projectDir: string): void {
    let engineRoot: string;
    try {
        engineRoot = path.dirname(require.resolve("@flint/engine/package.json"));
    } catch {
        console.warn("Could not resolve @flint/engine. Skipping engine types.");
        return;
    }

    const typesDir = path.join(engineRoot, "types");
    if (!fs.existsSync(typesDir)) {
        console.warn(`Engine types not built (missing ${typesDir}). Run \`npm run build:engine-types\` first.`);
        return;
    }

    const relPaths: string[] = [];
    walkFiles(typesDir, typesDir, relPaths, [".d.ts", ".json"]);

    for (const relPath of relPaths) {
        const dest = path.join(projectDir, "flint", relPath);
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.copyFileSync(path.join(typesDir, relPath), dest);
    }

    console.log(`Copied ${relPaths.length} engine type files to flint/.`);
}

export async function initProject(projectDir: string, options: { minimal?: boolean } = {}): Promise<void> {
    const projectDirAbs = path.resolve(projectDir);
    fs.mkdirSync(projectDirAbs, { recursive: true });

    if (fs.existsSync(path.join(projectDirAbs, "project.json"))) {
        throw new Error(`project.json already exists in ${projectDirAbs}.`);
    }

    const minimal = options.minimal ?? false;

    fs.writeFileSync(
        path.join(projectDirAbs, "project.json"),
        JSON.stringify(minimal ? minimalProjectData() : defaultProjectData(), null, 4)
    );
    fs.writeFileSync(
        path.join(projectDirAbs, "project-config.json"),
        JSON.stringify(defaultProjectConfig({ minimal }), null, 4)
    );
    fs.writeFileSync(path.join(projectDirAbs, "tsconfig.json"), defaultTsConfig);

    if (!minimal) {
        for (const file of defaultProjectFiles()) {
            const dest = path.join(projectDirAbs, file.path);
            fs.mkdirSync(path.dirname(dest), { recursive: true });
            fs.writeFileSync(dest, file.content);
        }
    }

    copyEngineTypes(projectDirAbs);

    console.log(`Created flint project in ${projectDirAbs}${minimal ? " (minimal)" : ""}.`);
}
