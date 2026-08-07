export function isAbsoluteUrl(url: string): boolean {
    return url.indexOf("://") > 0 || url.startsWith("//");
}

export function normalizeAssetUrl(input: string): string {
    const url = input.trim();
    if (!url) {
        return "";
    }
    if (isAbsoluteUrl(url)) {
        return url;
    }

    const stripped = url.replace(/^\/+/, "");
    if (!stripped) {
        return "";
    }
    if (stripped.startsWith("assets/")) {
        return stripped;
    }

    return "assets/" + stripped;
}