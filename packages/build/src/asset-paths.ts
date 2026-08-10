export function isAbsoluteUrl(url: string): boolean {
    return url.startsWith("//") || /^[a-z][a-z0-9+.-]*:\/\//i.test(url) || url.startsWith("data:") || url.startsWith("blob:");
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