import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");

const source = path.join(projectRoot, "node_modules", "planck", "dist", "planck.d.ts");
const target = path.join(projectRoot, "packages", "engine", "src", "public", "libs", "planck.d.ts");

fs.mkdirSync(path.dirname(target), { recursive: true });
fs.copyFileSync(source, target);
console.log(`planck.d.ts copied to ${path.relative(projectRoot, target)}`);