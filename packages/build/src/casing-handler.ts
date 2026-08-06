export class CasingHandler {
    public static splitPascalCase(pascalCaseString: string, joiner: " " | "-" = " "): string {
        const regex = /[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+|[A-Z]|[0-9]+/g;
        const words = pascalCaseString.match(regex);
        return words ? words.join(joiner).toLowerCase() : pascalCaseString;
    }

    public static joinToPascalCase(str: string): string {
        if (!str) return str;

        // Already PascalCase without separators (e.g. "SpinScript"): keep as-is.
        if (!/[-_\s]/.test(str) && /^[A-Z][a-z]/.test(str)) {
            return str;
        }

        // camelCase without separators (e.g. "spinScript"): split on word boundaries.
        if (!/[-_\s]/.test(str) && /^[a-z][a-zA-Z0-9]*[A-Z]/.test(str)) {
            return str
                .split(/(?=[A-Z])/)
                .map(word => word[0]!.toUpperCase() + word.slice(1).toLowerCase())
                .join("");
        }

        const normalized = str
            .replace(/[-_]+/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        return normalized
            .split(" ")
            .map(word =>
                word.length === 0
                    ? word
                    : word[0]!.toUpperCase() + word.slice(1).toLowerCase()
            )
            .join("");
    }
}
