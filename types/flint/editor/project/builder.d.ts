export declare class Builder {
    private static tab;
    private static compiled;
    private constructor();
    static compile(emitErrorMessages?: boolean, entryPoint?: string): Promise<boolean>;
    static build(): Promise<boolean>;
    static buildForEditor(emitErrorMessages?: boolean): Promise<boolean>;
}
