/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-explicit-any */
// DynamicModuleLoader.ts
type Deps = Record<string, any>;


interface ModuleRecord {
    id: string;
    code: string;
    url: string | null;
    lastImportTime: number | null;
    exports: any | null;
}


export class DynamicModuleLoader {
    private static modules = new Map<string, ModuleRecord>();
    private static baseUrl: string;


    private constructor(options?: { baseUrl?: string }) {
        DynamicModuleLoader.baseUrl = options?.baseUrl ?? import.meta.url;
    }


    private static rewriteImportPaths(code: string) {
        const staticImportRegex = /(^|\n)\s*(import\s+(?:[^'"]+from\s+)?|export\s+[^'"]*from\s+)['"]([^'"]+)['"]/g;
        const dynamicImportRegex = /import\s*\(\s*(['"])([^'"]+)\1\s*\)/g;


        const fixPath = (path: string) => {
            if (path.startsWith("./") || path.startsWith("../")) {
                return new URL(path, this.baseUrl).href;
            }
            return path;
        };


        code = code.replace(staticImportRegex, (full, pre, imp, path) => {
            return full.replace(path, fixPath(path));
        });


        code = code.replace(dynamicImportRegex, (full, quote, path) => {
            return `import(${quote + fixPath(path) + quote})`;
        });


        return code;
    }


    private static prepareCode(code: string, deps?: Deps) {
        const rewritten = this.rewriteImportPaths(code);
        const hasStaticImport = /\bimport\s+/.test(rewritten);


        if (!hasStaticImport && deps && Object.keys(deps).length > 0) {
            const transformed = rewritten.replace(/\bexport\s+default\s+/, "const __default = ");
            const depNames = Object.keys(deps);
            return `
export default (function(${depNames.join(",")}) {
${transformed};
return __default;
});
`;
        }


        return rewritten;
    }


    public static async loadModule(id: string, code: string, options?: { deps?: Deps }) {
        const deps = options?.deps ?? {};
        const prepared = this.prepareCode(code, deps);


        const existing = this.modules.get(id);
        if (existing && existing.url) {
            try { URL.revokeObjectURL(existing.url); } catch (e) { /* ignore */ }
        }


        const blob = new Blob([prepared], { type: "text/javascript" });
        const url = URL.createObjectURL(blob);
        // cash buster???
        const importUrl = url /*+ `?v=${crypto.randomUUID()}`*/;


        const rec: ModuleRecord = {
            id,
            code,
            url,
            lastImportTime: Date.now(),
            exports: null
        };
        this.modules.set(id, rec);


        try {
            const mod = await import(importUrl);
            if (!/\bimport\s+/.test(prepared) && Object.keys(deps).length > 0) {

                const factory = mod.default;
                rec.exports = factory(...Object.values(deps));
            } else {
                rec.exports = mod;
            }
            return rec.exports;
        } catch (err) {
            // if error -> delete it
            try { URL.revokeObjectURL(url); } catch (e) { /* ignore */ }
            rec.url = null;
            rec.exports = null;
            throw err;
        }
    }


    // Updates code of already existing module
    public static async updateModule(id: string, newCode: string, options?: { deps?: Deps }) {
        return this.loadModule(id, newCode, options);
    }


    // loads module if not loaded, if it is -> return it
    public static async ensureModule(id: string, codeSupplier: () => Promise<string> | string, options?: { deps?: Deps }) {
        const record = this.modules.get(id);
        if (record && record.exports) return record.exports;
        const code = typeof codeSupplier === "function" ? await codeSupplier() : codeSupplier;
        return this.loadModule(id, code, options);
    }


    public static getExports(id: string) {
        const rec = this.modules.get(id);
        if (!rec) return null;
        return rec.exports;
    }

    public static getDefaultExport(id: string) {
        const exports = this.getExports(id);
        if (!exports) return null;

        if (typeof exports === "object" && "default" in exports) return exports.default;
        return exports;
    }


    public static unloadModule(id: string) {
        const rec = this.modules.get(id);
        if (!rec) return false;
        if (rec.url) {
            try { URL.revokeObjectURL(rec.url); } catch (e) { /* ignore */ }
        }
        this.modules.delete(id);
        return true;
    }


    public static unloadAll() {
        for (const [id, rec] of this.modules.entries()) {
            if (rec.url) {
                try { URL.revokeObjectURL(rec.url); } catch (e) { /* ignore */ }
            }
        }
        this.modules.clear();
    }
}