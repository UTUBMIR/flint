import { CasingHandler } from "./casing-handler";

export function makeComponentSource(name: string): string {
    return `import Component from "@flint/runtime/component";

export class ${name} extends Component {
    start() {
        // Code that should run once on start
    }

    update() {
        // Code that should run every frame
    }
}
`;
}

export function componentFileName(name: string): string {
    return CasingHandler.splitPascalCase(CasingHandler.joinToPascalCase(name), "-") + ".ts";
}
