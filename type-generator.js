import fs from "fs";
import path from "path";

function getAllFiles(dir, allowedExt = [], baseDir = dir) {
    let results = [];
    const list = fs.readdirSync(dir, { withFileTypes: true });

    for (const entry of list) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
            results = results.concat(getAllFiles(fullPath, allowedExt, baseDir));
        } else if (entry.isFile() && entry.name != "main.d.ts") { // Skip main file because id doesn`t export anything
            if (allowedExt.some(ext => entry.name.endsWith(ext))) {
                results.push(path.relative(baseDir, fullPath).replace(/\\/g, "/"));
            }
        }
    }
    return results;
}

const typesDir = path.resolve("./types");
const srcDir = path.resolve("./src");

const typeFiles = getAllFiles(typesDir, [".d.ts"]);

const jsonFiles = getAllFiles(srcDir, [".json"]);

const output = {
    types: typeFiles,
    json: jsonFiles
};

fs.writeFileSync(
    path.join(typesDir, "files.json"),
    JSON.stringify(output, null, 2)
);

console.log("files.json generated successfully!");