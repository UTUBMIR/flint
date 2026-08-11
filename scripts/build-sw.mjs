import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function getAllFiles(dir, baseDir) {
    const results = [];
    if (!fs.existsSync(dir)) return results;

    const list = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of list) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results.push(...getAllFiles(fullPath, baseDir));
        } else if (entry.isFile() && !entry.name.endsWith(".map")) {
            results.push(path.relative(baseDir, fullPath).replace(/\\/g, "/"));
        }
    }
    return results;
}

function normalizeVersion(version) {
    return String(version).replace(/^[~^]/, "");
}

const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
const monacoVersion = normalizeVersion(packageJson.dependencies["monaco-editor"]);
const shoelaceVersion = normalizeVersion(packageJson.devDependencies["@shoelace-style/shoelace"]);
const esbuildVersion = normalizeVersion(packageJson.devDependencies["esbuild-wasm"]);

const shoelaceIcons = [
    "arrow-90deg-left",
    "arrow-clockwise",
    "arrow-repeat",
    "box",
    "x-lg",
    "qr-code",
    "box-arrow-in-down-right",
    "window",
    "box-arrow-up-right",
    "wrench-adjustable",
    "boxes",
    "check2-circle",
    "code-slash",
    "controller",
    "diagram-3",
    "download",
    "exclamation-octagon",
    "exclamation-triangle",
    "file",
    "file-earmark-arrow-down",
    "file-earmark-arrow-up",
    "floppy",
    "folder2-open",
    "clock-history",
    "gear",
    "info-circle",
    "layers",
    "list-columns-reverse",
    "list-ul",
    "lock-fill",
    "unlock-fill",
    "play",
    "plus-lg",
    "plus-square",
    "stop",
    "text-left",
    "trash",
    "upload",
    "tv",
    "play-circle",
    "braces"
];

const args = process.argv.slice(2);
function argValue(name) {
    const index = args.indexOf(name);
    return index >= 0 ? args[index + 1] : undefined;
}

const mode = argValue("--mode") ?? "default";
const outFile = argValue("--out") ?? (mode === "cdn" ? path.join(projectRoot, "cdn", "service-worker.js") : path.join(projectRoot, "service-worker.js"));
const templatePath = argValue("--template") ?? path.join(__dirname, "service-worker.template.js");

function buildDefaultPrecache() {
    const distDir = path.join(projectRoot, "dist");
    const files = getAllFiles(distDir, distDir);

    return [
        "./",
        "./index.html",
        "./style.css",
        "./manifest.webmanifest",
        "./assets/icon.svg",
        ...files.map((file) => `./dist/${file}`)
    ];
}

function buildCdnPrecache() {
    const monacoBase = path.join(projectRoot, "node_modules", "monaco-editor", "min", "vs");
    const monacoFiles = getAllFiles(monacoBase, monacoBase);

    const shoelaceBase = "https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@";
    const monacoBaseUrl = `https://unpkg.com/monaco-editor@${monacoVersion}/min/vs`;

    return [
        "./",
        "./index.html",
        "./style.css",
        "./manifest.webmanifest",
        "./assets/icon.svg",
        "./dist/main.css",
        "./dist/main.js",
        `https://cdn.jsdelivr.net/npm/esbuild-wasm@${esbuildVersion}/esm/browser.min.js`,
        `https://cdn.jsdelivr.net/npm/esbuild-wasm@${esbuildVersion}/esbuild.wasm`,
        `${shoelaceBase}${shoelaceVersion}/cdn/themes/dark.css`,
        `${shoelaceBase}${shoelaceVersion}/cdn/shoelace.js`,
        ...shoelaceIcons.map((name) => `${shoelaceBase}${shoelaceVersion}/cdn/assets/icons/${name}.svg`),
        ...monacoFiles.map((file) => `${monacoBaseUrl}/${file}`)
    ];
}

const precache = mode === "cdn" ? buildCdnPrecache() : buildDefaultPrecache();
const template = fs.readFileSync(templatePath, "utf8");

if (!template.includes("__PRECACHE__")) {
    throw new Error(`SW template is missing the __PRECACHE__ token: ${templatePath}`);
}

const output = template.replace("__PRECACHE__", JSON.stringify(precache, null, 4));

fs.mkdirSync(path.dirname(outFile), { recursive: true });
fs.writeFileSync(outFile, output);

console.log(`service worker generated (${mode}): ${path.relative(projectRoot, outFile)} (${precache.length} precache entries)`);