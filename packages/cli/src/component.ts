import fs from "node:fs";
import path from "node:path";
import { componentFileName, makeComponentSource, CasingHandler } from "@flint/build";

type ProjectConfig = {
    components: { name: string; file: string }[];
};

export async function createComponent(projectDir: string, name: string): Promise<void> {
    const projectDirAbs = path.resolve(projectDir);

    const configPath = path.join(projectDirAbs, "project-config.json");
    if (!fs.existsSync(configPath)) {
        throw new Error(`No project-config.json found in ${projectDirAbs}. Is this a flint project?`);
    }

    const config = JSON.parse(fs.readFileSync(configPath, "utf8")) as ProjectConfig;

    const className = CasingHandler.joinToPascalCase(name);
    const relativeFilePath = `assets/${componentFileName(className)}`;

    if (config.components.some(c => c.name === className)) {
        throw new Error(`Component "${className}" is already registered.`);
    }

    const filePath = path.join(projectDirAbs, relativeFilePath);
    if (fs.existsSync(filePath)) {
        throw new Error(`File already exists: ${filePath}`);
    }

    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    fs.writeFileSync(filePath, makeComponentSource(className));

    config.components.push({ name: className, file: "/" + relativeFilePath });
    fs.writeFileSync(configPath, JSON.stringify(config, null, 4));

    console.log(`Created component ${className} at ${relativeFilePath} and registered it in project-config.json.`);
}
