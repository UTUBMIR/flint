export function hashContent(content: string): number {
    let h = 5381;
    for (let i = 0; i < content.length; i++) h = (((h << 5) + h) | 0) + content.charCodeAt(i) | 0;
    return h;
}
