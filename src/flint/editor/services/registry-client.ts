export type RegistryDist = { tarball: string; integrity: string; shasum: string };
export type RegistryPackage = {
    name: string;
    version: string;
    description?: string;
    main?: string;
    module?: string;
    browser?: string;
    types?: string;
    typings?: string;
    dist: RegistryDist;
};

async function verifyIntegrity(data: ArrayBuffer, integrity: string): Promise<boolean> {
    if (!integrity) return true;
    const match = integrity.match(/^sha512-([A-Za-z0-9+/=]+)$/);
    if (!match) return true;
    const expectedB64 = match[1]!;
    try {
        const digest = await crypto.subtle.digest("SHA-512", data);
        const actualB64 = btoa(String.fromCharCode(...new Uint8Array(digest)));
        return actualB64 === expectedB64;
    } catch {
        return true;
    }
}

export class RegistryClient {
    public static async fetchVersion(name: string, version?: string): Promise<RegistryPackage | null> {
        const encoded = encodeURIComponent(name);
        const url = version && version !== "latest" ? `https://registry.npmjs.org/${encoded}/${encodeURIComponent(version)}` : `https://registry.npmjs.org/${encoded}/latest`;
        try {
            const res = await fetch(url, { headers: { Accept: "application/json" } });
            if (!res.ok) return null;
            const data = (await res.json()) as RegistryPackage & { dist?: RegistryDist };
            if (!data?.dist?.tarball || !data?.dist?.integrity) return data as RegistryPackage;
            return data as RegistryPackage;
        } catch { return null; }
    }

    public static async fetchLatest(name: string): Promise<RegistryPackage | null> {
        return this.fetchVersion(name, "latest");
    }

    public static async fetchTarballVerified(tarballUrl: string, integrity: string): Promise<ArrayBuffer | null> {
        try {
            const res = await fetch(tarballUrl);
            if (!res.ok) return null;
            const buf = await res.arrayBuffer();
            const ok = await verifyIntegrity(buf, integrity);
            if (!ok) {
                console.warn(`Integrity mismatch for ${tarballUrl}`);
                return null;
            }
            return buf;
        } catch { return null; }
    }

    public static async fetchText(url: string): Promise<string | null> {
        try {
            const r = await fetch(url, { headers: { Accept: "*/*" } });
            if (!r.ok) return null;
            const t = await r.text();
            if (t.length < 80) return null;
            if (t.includes("Could not find file") || t.includes("Cannot find package") || t.includes("Invalid package")) return null;
            return t;
        } catch { return null; }
    }
}
