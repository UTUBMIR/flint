import fs from "fs";
import path from "path";

function getAllFiles(dir, baseDir = dir) {
    let results = [];
    const list = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of list) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            results = results.concat(getAllFiles(fullPath, baseDir));
        } else if (entry.isFile() && entry.name.endsWith(".d.ts")) {
            results.push(path.relative(baseDir, fullPath).replace(/\\/g, "/"));
        }
    }
    return results;
}

const typesDir = path.resolve("./types");
const files = getAllFiles(typesDir);
fs.writeFileSync(path.join(typesDir, "files.json"), JSON.stringify(files, null, 2));
console.log("files.json generated successfully!");