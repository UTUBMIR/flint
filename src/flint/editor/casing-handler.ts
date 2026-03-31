export class CasingHandler {
    public static splitPascalCase(pascalCaseString: string, joiner: " " | "-" = " "): string {
        const regex = /[A-Z]{2,}(?=[A-Z][a-z]+[0-9]*|\b)|[A-Z]?[a-z]+[0-9]*|[A-Z]|[0-9]+/g;
        const words = pascalCaseString.match(regex);
        return words ? words.join(joiner).toLowerCase() : pascalCaseString;
    }

    public static joinToPascalCase(str: string): string {
        if (!str) return str;

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