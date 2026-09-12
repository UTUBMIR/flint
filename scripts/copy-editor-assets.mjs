import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

function ensureDir(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function copyRecursive(source, target) {
    ensureDir(path.dirname(target));
    fs.cpSync(source, target, { recursive: true, force: true });
}

const distVendorDir = path.join(projectRoot, "dist", "vendor");
const shoelaceDir = path.join(distVendorDir, "shoelace");
const monacoDir = path.join(distVendorDir, "monaco");
const esbuildDir = path.join(distVendorDir, "esbuild");

const shoelaceIcons = JSON.parse(fs.readFileSync(path.join(__dirname, "shoelace-icons.json"), "utf8"));

fs.rmSync(monacoDir, { recursive: true, force: true });
fs.rmSync(shoelaceDir, { recursive: true, force: true });
fs.rmSync(esbuildDir, { recursive: true, force: true });

copyRecursive(
    path.join(projectRoot, "node_modules", "monaco-editor", "min", "vs"),
    path.join(monacoDir, "vs")
);

copyRecursive(
    path.join(projectRoot, "node_modules", "@shoelace-style", "shoelace", "cdn", "themes", "dark.css"),
    path.join(shoelaceDir, "themes", "dark.css")
);

for (const iconName of shoelaceIcons) {
    copyRecursive(
        path.join(projectRoot, "node_modules", "@shoelace-style", "shoelace", "cdn", "assets", "icons", `${iconName}.svg`),
        path.join(shoelaceDir, "assets", "icons", `${iconName}.svg`)
    );
}

copyRecursive(
    path.join(projectRoot, "node_modules", "esbuild-wasm", "esbuild.wasm"),
    path.join(esbuildDir, "esbuild.wasm")
);

copyRecursive(
    path.join(projectRoot, "node_modules", "esbuild-wasm", "esm", "browser.min.js"),
    path.join(esbuildDir, "browser.min.js")
);

const xtermDir = path.join(distVendorDir, "xterm");
fs.rmSync(xtermDir, { recursive: true, force: true });
try {
    copyRecursive(
        path.join(projectRoot, "node_modules", "@xterm", "xterm", "css", "xterm.css"),
        path.join(xtermDir, "xterm.css")
    );
} catch { /* xterm css optional via bundler */ }
