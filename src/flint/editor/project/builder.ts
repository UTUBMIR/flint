export default class Builder {
    private constructor() { }

    public static build(tsCode: string): string {
        return ts.transpileModule(tsCode, {
            compilerOptions: {
                module: ts.ModuleKind.ESNext,
                target: ts.ScriptTarget.ESNext,
            }
        }).outputText;
    }

    public static extractClassName(source: string): string | null {
        const match = source.match(/class\s+([A-Za-z0-9_]+)/);
        return match ? match[1]??null : null;
    }
}