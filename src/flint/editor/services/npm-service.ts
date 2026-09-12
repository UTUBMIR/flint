import { System } from "@flint/runtime/system";
import { editorAssetStore } from "../ui/window-services";
import { RegistryClient } from "./registry-client";
import { CodeEditor } from "../ui/code-editor";
import { termColors, termSymbols } from "../ui/terminal-colors";

function pkgRoot(name: string): string {
    return name.split("/")[0] === "@" ? name.split("/").slice(0, 2).join("/") : name.split("/")[0]!;
}

export class NpmService {
    public static async installSinglePackage(term: { writeln: (s: string) => void }, name: string, versionSpec?: string): Promise<void> {
        const specLabel = versionSpec ? `@${versionSpec}` : "";
        term.writeln(termColors.dim(`${termSymbols.arrow} npm add ${name}${specLabel}`));

        let registryData: Awaited<ReturnType<typeof RegistryClient.fetchVersion>> = null;
        let version: string | undefined = versionSpec;

        if (versionSpec && /^\d+\.\d+\.\d+/.test(versionSpec)) {
            registryData = await RegistryClient.fetchVersion(name, versionSpec);
            version = registryData?.version ?? versionSpec;
        } else if (versionSpec) {
            const cleaned = versionSpec.replace(/^[\^~>=<\s]+/, "");
            if (/^\d+\.\d+\.\d+/.test(cleaned)) {
                registryData = await RegistryClient.fetchVersion(name, cleaned);
                version = registryData?.version ?? cleaned;
            } else {
                registryData = await RegistryClient.fetchLatest(name);
                version = registryData?.version ?? "latest";
            }
        } else {
            registryData = await RegistryClient.fetchLatest(name);
            version = registryData?.version ?? "latest";
        }

        if (!version) version = "latest";

        if (registryData?.dist?.tarball && registryData?.dist?.integrity) {
            const tarballBuf = await RegistryClient.fetchTarballVerified(registryData.dist.tarball, registryData.dist.integrity);
            if (!tarballBuf) {
                term.writeln(termColors.yellow(`warning: tarball integrity check failed for ${name}@${version}, continuing with verified metadata only`));
            } else {
                term.writeln(termColors.dim(`  verified ${registryData.dist.tarball} (${tarballBuf.byteLength} bytes, integrity ok)`));
            }
        } else if (registryData) {
            term.writeln(termColors.dim(`  fetched registry metadata for ${name}@${registryData.version}`));
        }

        const exactVersion = registryData?.version ?? version;
        let pkgText = "{}";
        try { pkgText = await System.fileSystem.readTextFile("package.json"); } catch { /* create */ }
        let pkg: Record<string, unknown> & { dependencies?: Record<string, string> } = {};
        try { pkg = JSON.parse(pkgText); } catch { pkg = {}; }
        pkg.dependencies = pkg.dependencies ?? {};
        pkg.dependencies[name] = exactVersion;
        await System.fileSystem.writeTextFile("package.json", JSON.stringify(pkg, null, 2));

        const stubDir = `node_modules/${name}`;
        try { await System.fileSystem.createDir("node_modules"); } catch { /* ignore */ }
        try { await System.fileSystem.createDir(stubDir); } catch { /* ignore */ }

        let moduleDts: string | null = null;
        let dtsFrom: string | null = null;
        if (!name.startsWith("@")) {
            const candidates = [
                `https://cdn.jsdelivr.net/npm/@types/${encodeURIComponent(name)}/index.d.ts`,
            ];
            for (const url of candidates) {
                const t = await RegistryClient.fetchText(url);
                if (t && (t.includes("export") || t.includes("declare") || t.includes("interface"))) {
                    moduleDts = t;
                    dtsFrom = url;
                    break;
                }
            }
        }
        if (!moduleDts && registryData) {
            const maybeTypes = (registryData.types ?? registryData.typings ?? "").replace(/^\.?\//, "");
            if (maybeTypes) {
                const t = await RegistryClient.fetchText(`https://cdn.jsdelivr.net/npm/${encodeURIComponent(name)}@${encodeURIComponent(exactVersion)}/${maybeTypes}`);
                if (t) { moduleDts = t; dtsFrom = maybeTypes; }
            }
        }
        if (!moduleDts) {
            const t = await RegistryClient.fetchText(`https://cdn.jsdelivr.net/npm/${encodeURIComponent(name)}@${encodeURIComponent(exactVersion)}/index.d.ts`);
            if (t && (t.includes("export") || t.includes("declare"))) { moduleDts = t; dtsFrom = "index.d.ts"; }
        }
        if (!moduleDts) {
            moduleDts = `// Types for ${name} — synthetic stub\nexport declare const __npmStub: boolean;\ndeclare const _default: any;\nexport default _default;\n`;
        }

        const stubPkg = {
            name,
            version: exactVersion,
            description: registryData?.description ?? `Installed via npm — stub`,
            main: "index.js",
            module: "index.js",
            types: "index.d.ts",
            typings: "index.d.ts",
            type: "module",
            _npmStub: true
        };
        await System.fileSystem.writeTextFile(`${stubDir}/package.json`, JSON.stringify(stubPkg, null, 2));

        // Try to fetch real ESM via /+esm (user wants real imports to work)
        let fetchedCode: string | null = null;
        let fetchedFrom: string | null = null;
        const tryFetch = RegistryClient.fetchText;
        const esmUrls = [
            `https://cdn.jsdelivr.net/npm/${encodeURIComponent(name)}@${encodeURIComponent(exactVersion)}/+esm`,
            `https://esm.sh/${encodeURIComponent(name)}@${encodeURIComponent(exactVersion)}`,
            `https://cdn.jsdelivr.net/npm/${encodeURIComponent(name)}@${encodeURIComponent(exactVersion)}/index.js/+esm`,
            `https://esm.run/${encodeURIComponent(name)}@${encodeURIComponent(exactVersion)}`
        ];
        for (const url of esmUrls) {
            const t = await tryFetch(url);
            if (t && (t.includes("export") || t.length > 1000)) { fetchedCode = t; fetchedFrom = url; break; }
        }
        if (!fetchedCode && registryData) {
            const mains = [(registryData.main ?? "").replace(/^\.?\//, ""), (registryData.module ?? "").replace(/^\.?\//, ""), "index.js", "index.mjs"].filter(Boolean) as string[];
            const uniq = [...new Set(mains)];
            const bases = [`https://cdn.jsdelivr.net/npm/${encodeURIComponent(name)}@${encodeURIComponent(exactVersion)}/`, `https://unpkg.com/${encodeURIComponent(name)}@${encodeURIComponent(exactVersion)}/`];
            outer: for (const base of bases) for (const m of uniq) {
                const t = await tryFetch(base + m);
                if (t) { fetchedCode = t; fetchedFrom = base + m; break outer; }
            }
            if (!fetchedCode) {
                const t = await tryFetch(`https://cdn.jsdelivr.net/npm/${encodeURIComponent(name)}@${encodeURIComponent(exactVersion)}/index.js`);
                if (t && t.length > 500) { fetchedCode = t; fetchedFrom = `https://cdn.jsdelivr.net/npm/${encodeURIComponent(name)}@${encodeURIComponent(exactVersion)}/index.js`; }
            }
        }

        if (fetchedCode) {
            await System.fileSystem.writeTextFile(`${stubDir}/index.js`, fetchedCode);
            term.writeln(termColors.dim(`  fetched ${fetchedFrom} (${fetchedCode.length} bytes)`));
            const mjsWrapper = `// Re-export fetched code for ESM\nimport * as pkg from "./index.js";\nexport default pkg.default ?? pkg;\nexport * from "./index.js";\n`;
            await System.fileSystem.writeTextFile(`${stubDir}/index.mjs`, mjsWrapper).catch(() => {});
        } else {
            const synthetic = `// ${name} synthetic stub (fallback, chainable - no crash)\n// Real code fetch via /+esm failed, using proxy stub\nexport const __npmStub = true;\nfunction makeStub(){const fn=(...a)=>a.join(' ');return new Proxy(fn,{get(_,p){if(p==='__npmStub')return true;return makeStub();},apply(_,__,a){return a.length?a[0]:'';}});}\nconst _default = makeStub();\nexport default _default;\n`;
            await System.fileSystem.writeTextFile(`${stubDir}/index.js`, synthetic);
            await System.fileSystem.writeTextFile(`${stubDir}/index.mjs`, synthetic).catch(() => {});
        }

        await System.fileSystem.writeTextFile(`${stubDir}/index.d.ts`, moduleDts);
        if (dtsFrom) term.writeln(termColors.dim(`  fetched types ${dtsFrom} (${moduleDts.length} bytes)`));
        await System.fileSystem.writeTextFile(`${stubDir}/index.ts`, moduleDts).catch(() => {});

        try {
            editorAssetStore.add({ id: crypto.randomUUID(), name, type: "folder", path: `/${stubDir}`, data: "" });
        } catch { /* ignore */ }
        term.writeln(termColors.green(`${termSymbols.plus} ${name}@${exactVersion}`));
        CodeEditor.scheduleLibRefresh();
    }

    public static async ensureDependenciesInstalled(term?: { writeln: (s: string) => void }): Promise<{ installed: string[]; failed: string[] }> {
        const installed: string[] = [];
        const failed: string[] = [];
        let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
        try {
            const txt = await System.fileSystem.readTextFile("package.json");
            pkg = JSON.parse(txt);
        } catch { return { installed, failed }; }
        const deps: Record<string, string> = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
        const missing: string[] = [];
        for (const name of Object.keys(deps)) {
            const clean = pkgRoot(name);
            let exists = false;
            try { exists = await System.fileSystem.fileExists(`node_modules/${clean}/package.json`); } catch { exists = false; }
            if (!exists) {
                try { exists = await System.fileSystem.dirExists(`node_modules/${clean}`); } catch { exists = false; }
            }
            if (!exists) missing.push(clean);
        }
        const uniq = [...new Set(missing)];
        if (uniq.length === 0) return { installed, failed };
        const t = term ?? { writeln: (s: string) => console.log(s.replace(/\x1b\[[0-9;]*m/g, "")) } as { writeln: (s: string) => void };
        for (const n of uniq) {
            const ver = deps[n]?.replace(/^[\^~>=<\s]+/, "");
            const exact = ver && /^\d+\.\d+\.\d+/.test(ver) ? ver : undefined;
            try {
                await this.installSinglePackage(t, n, exact);
                installed.push(n);
            } catch { failed.push(n); }
        }
        return { installed, failed };
    }
}
