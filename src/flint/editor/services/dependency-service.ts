import { System } from "@flint/runtime/system";
import { NpmService } from "./npm-service";

export type BuildFailedEvent = { missing: string[]; raw: string };

export class DependencyService {
    private static listeners = new Set<(e: BuildFailedEvent) => void>();

    public static onBuildFailed(listener: (e: BuildFailedEvent) => void): () => void {
        DependencyService.listeners.add(listener);
        return () => DependencyService.listeners.delete(listener);
    }

    public static emitBuildFailed(missing: string[], raw: string): void {
        const evt: BuildFailedEvent = { missing, raw };
        for (const l of DependencyService.listeners) {
            try { l(evt); } catch { /* ignore */ }
        }
    }

    public static async ensureInstalled(term?: { writeln: (s: string) => void }): Promise<{ installed: string[]; failed: string[] }> {
        return NpmService.ensureDependenciesInstalled(term);
    }

    public static parseMissingModule(message: string): string | null {
        const m = message.match(/Cannot find module ['"]([^'"]+)['"]|Cannot find module ['"]([^'"]+)['"] or its corresponding type declarations|Missing virtual file:\s*(\S+)|Failed to resolve.*['"]([^'"]+)['"]|No matching export.*virtual:([^'"]+)/);
        if (!m) return null;
        return m[1] ?? m[2] ?? m[3] ?? m[4] ?? m[5] ?? null;
    }

    public static async ensureFromPackageJson(term?: { writeln: (s: string) => void }): Promise<{ installed: string[]; failed: string[] }> {
        return NpmService.ensureDependenciesInstalled(term);
    }

    public static extractMissingPackages(messages: string[]): string[] {
        const missing = new Set<string>();
        for (const msg of messages) {
            const raw = this.parseMissingModule(msg);
            if (!raw) continue;
            if (raw.startsWith(".") || raw.startsWith("/") || raw.startsWith("@flint")) continue;
            const pkg = raw.split("/")[0] === "@" ? raw.split("/").slice(0, 2).join("/") : raw.split("/")[0] ?? raw;
            if (pkg) missing.add(pkg);
        }
        return [...missing];
    }

    public static async isInstalled(pkgName: string): Promise<boolean> {
        const clean = pkgName.split("/")[0] === "@" ? pkgName.split("/").slice(0, 2).join("/") : pkgName.split("/")[0]!;
        try {
            if (await System.fileSystem.fileExists(`node_modules/${clean}/package.json`)) return true;
        } catch { /* ignore */ }
        try {
            if (await System.fileSystem.dirExists(`node_modules/${clean}`)) return true;
        } catch { /* ignore */ }
        return false;
    }
}
