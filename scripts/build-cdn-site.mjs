import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const cdnDir = path.join(projectRoot, "cdn");

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function copyRecursive(source, target) {
    ensureDir(path.dirname(target));
    fs.cpSync(source, target, { recursive: true, force: true });
}

function replaceOrThrow(source, searchValue, replaceValue) {
    if (!source.includes(searchValue)) {
        throw new Error(`Expected string was not found while preparing CDN site: ${searchValue}`);
    }

    return source.replace(searchValue, replaceValue);
}

fs.rmSync(cdnDir, { recursive: true, force: true });
ensureDir(cdnDir);

const packageJson = JSON.parse(fs.readFileSync(path.join(projectRoot, "package.json"), "utf8"));
const normalizeVersion = (version) => String(version).replace(/^[~^]/, "");
const monacoVersion = normalizeVersion(packageJson.dependencies["monaco-editor"]);
const shoelaceVersion = normalizeVersion(packageJson.devDependencies["@shoelace-style/shoelace"]);

let indexHtml = fs.readFileSync(path.join(projectRoot, "index.html"), "utf8");

indexHtml = replaceOrThrow(
    indexHtml,
    '<link rel="stylesheet" href="./dist/vendor/shoelace/themes/dark.css">',
    `<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@${shoelaceVersion}/cdn/themes/dark.css">`
);

indexHtml = replaceOrThrow(
    indexHtml,
    '<link rel="stylesheet" data-name="vs/editor/editor.main" href="./dist/vendor/monaco/vs/editor/editor.main.css">',
    `<link rel="stylesheet" data-name="vs/editor/editor.main" href="https://unpkg.com/monaco-editor@${monacoVersion}/min/vs/editor/editor.main.css">`
);

indexHtml = replaceOrThrow(
    indexHtml,
    '        window.FLINT_MONACO_VS_PATH = "./dist/vendor/monaco/vs";',
    `        window.FLINT_MONACO_VS_PATH = "https://unpkg.com/monaco-editor@${monacoVersion}/min/vs";`
);

indexHtml = replaceOrThrow(
    indexHtml,
    '<script src="./dist/vendor/monaco/vs/loader.js"></script>',
    `<script src="https://unpkg.com/monaco-editor@${monacoVersion}/min/vs/loader.js"></script>`
);

indexHtml = replaceOrThrow(
    indexHtml,
    '<script src="./dist/vendor/monaco/vs/editor/editor.main.js"></script>',
    `<script src="https://unpkg.com/monaco-editor@${monacoVersion}/min/vs/editor/editor.main.js"></script>`
);

indexHtml = replaceOrThrow(
    indexHtml,
    '<script type="module" src="./dist/vendor/shoelace/shoelace.js"></script>',
    `<script type="module" src="https://cdn.jsdelivr.net/npm/@shoelace-style/shoelace@${shoelaceVersion}/cdn/shoelace.js"></script>`
);

fs.writeFileSync(path.join(cdnDir, "index.html"), indexHtml);

copyRecursive(path.join(projectRoot, "style.css"), path.join(cdnDir, "style.css"));
