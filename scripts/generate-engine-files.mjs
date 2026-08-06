import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const engineSrcDir = path.join(projectRoot, "packages", "engine", "src");
const engineTypesDir = path.join(projectRoot, "packages", "engine", "types");
const editorSrcDir = path.join(projectRoot, "src", "flint", "editor");
const outputFile = path.join(projectRoot, "src", "flint", "engine-files.ts");

// Editor files imported from generated user code (e.g. EditorBridge in preview mode).
// Keep in sync with packages/build/src/generate-main.ts.
const editorFilesToEmbed = [
    path.join("project", "editor-bridge.ts")
];

function getAllFiles(dir, baseDir, allowedExt) {
    const results = [];
    if (!fs.existsSync(dir)) return results;

    const list = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of list) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            results.push(...getAllFiles(fullPath, baseDir, allowedExt));
        } else if (entry.isFile()) {
            if (allowedExt.some(ext => entry.name.endsWith(ext))) {
                results.push(path.relative(baseDir, fullPath).replace(/\\/g, "/"));
            }
        }
    }
    return results;
}

function toMap(relPaths) {
    const map = {};
    for (const relPath of relPaths) {
        const sourcePath = path.join(engineSrcDir, relPath);
        map[`flint/${relPath}`] = fs.readFileSync(sourcePath, "utf8");
    }
    return map;
}

const srcFiles = getAllFiles(engineSrcDir, engineSrcDir, [".ts", ".js", ".json"]);
const typeFiles = getAllFiles(engineTypesDir, engineTypesDir, [".d.ts"]);
const jsonFiles = getAllFiles(engineSrcDir, engineSrcDir, [".json"]);

const engineSrcFiles = toMap(srcFiles);

const engineTypeFiles = {};
for (const relPath of typeFiles) {
    engineTypeFiles[`flint/${relPath}`] = fs.readFileSync(path.join(engineTypesDir, relPath), "utf8");
}
for (const relPath of jsonFiles) {
    engineTypeFiles[`flint/${relPath}`] = fs.readFileSync(path.join(engineSrcDir, relPath), "utf8");
}

const editorSrcFiles = {};
for (const relPath of editorFilesToEmbed) {
    const sourcePath = path.join(editorSrcDir, relPath);
    if (!fs.existsSync(sourcePath)) {
        throw new Error(`Editor file to embed not found: ${sourcePath}`);
    }
    editorSrcFiles[`flint/editor/${relPath.replace(/\\/g, "/")}`] = fs.readFileSync(sourcePath, "utf8");
}

const content = `// This file is auto-generated. Do not edit.
// Regenerate with: npm run generate:engine-files

export const engineSrcFiles: Record<string, string> = ${JSON.stringify(engineSrcFiles, null, 2)};

export const engineTypeFiles: Record<string, string> = ${JSON.stringify(engineTypeFiles, null, 2)};

export const editorSrcFiles: Record<string, string> = ${JSON.stringify(editorSrcFiles, null, 2)};
`;

fs.mkdirSync(path.dirname(outputFile), { recursive: true });
fs.writeFileSync(outputFile, content);

console.log(`engine-files.ts generated: ${Object.keys(engineSrcFiles).length} source files, ${Object.keys(engineTypeFiles).length} type files, ${Object.keys(editorSrcFiles).length} editor files.`);
