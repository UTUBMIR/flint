import type { ComponentContainer } from "golden-layout";
import type { Terminal as XTerm } from "@xterm/xterm";
import type { FitAddon as XFitAddon } from "@xterm/addon-fit";
import { System } from "@flint/runtime/system";
import type { WindowType } from "./window-framework";
import { CodeEditor } from "./code-editor";
import { NpmService } from "../services/npm-service";
import { termColors, termSymbols } from "./terminal-colors";

type WindowSpawner = (type: WindowType) => string;

type TerminalWindowController = {
    instanceId: string;
    container: HTMLElement;
    panelContainer: ComponentContainer | null;
    term: XTerm | null;
    fitAddon: XFitAddon | null;
    resizeObserver: ResizeObserver | null;
    setTitle: (title: string) => void;
    placeholderEl: HTMLElement | null;
    started: boolean;
    inputBuffer: string;
    history: string[];
    historyIndex: number;
};

export class TerminalProvider {
    private static readonly windows = new Map<string, TerminalWindowController>();
    private static activeWindowId: string | null = null;
    private static spawnWindow: WindowSpawner | null = null;
    private static xtermLoadPromise: Promise<{ Terminal: typeof XTerm; FitAddon: typeof XFitAddon }> | null = null;

    public static setWindowSpawner(spawner: WindowSpawner): void {
        this.spawnWindow = spawner;
    }

    private static async loadXterm(): Promise<{ Terminal: typeof XTerm; FitAddon: typeof XFitAddon }> {
        if (this.xtermLoadPromise) return this.xtermLoadPromise;
        this.xtermLoadPromise = (async () => {
            try {
                const [{ Terminal }, { FitAddon }] = await Promise.all([
                    import("@xterm/xterm"),
                    import("@xterm/addon-fit")
                ]);
                try { await import("@xterm/xterm/css/xterm.css"); } catch { /* ignore bundler css handling */ }
                return { Terminal: Terminal as unknown as typeof XTerm, FitAddon: FitAddon as unknown as typeof XFitAddon };
            } catch (e) {
                const w = window as unknown as { Terminal?: typeof XTerm; FitAddon?: typeof XFitAddon };
                if (w.Terminal && w.FitAddon) return { Terminal: w.Terminal, FitAddon: w.FitAddon };
                throw e;
            }
        })();
        return this.xtermLoadPromise;
    }

    public static async createWindow(
        instanceId: string,
        container: HTMLElement,
        setTitle: (title: string) => void,
        panelContainer?: ComponentContainer
    ): Promise<void> {
        const placeholderEl = document.createElement("div");
        placeholderEl.className = "flint-terminal-placeholder";
        placeholderEl.textContent = "No project open — open a project to use the terminal (npm).";
        placeholderEl.style.cssText = "display:flex;align-items:center;justify-content:center;height:100%;color:#888;font-size:13px;padding:16px;text-align:center;";

        const controller: TerminalWindowController = {
            instanceId,
            container,
            panelContainer: panelContainer ?? null,
            term: null,
            fitAddon: null,
            resizeObserver: null,
            setTitle,
            placeholderEl,
            started: false,
            inputBuffer: "",
            history: [],
            historyIndex: -1,
        };

        this.windows.set(instanceId, controller);
        if (!this.activeWindowId) this.activeWindowId = instanceId;

        container.style.display = "flex";
        container.style.flexDirection = "column";
        container.style.height = "100%";
        container.style.minHeight = "0";

        if (!System.fileSystem?.started) {
            container.appendChild(placeholderEl);
            return;
        }

        await this.ensureTerminalStarted(controller);
    }

    private static async ensureTerminalStarted(controller: TerminalWindowController): Promise<void> {
        if (controller.started) return;
        controller.started = true;
        try {
            const { Terminal, FitAddon } = await this.loadXterm();
            const term = new Terminal({
                cursorBlink: true,
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
                fontSize: 13,
                theme: { background: "#1e1e1e", foreground: "#cccccc" },
                convertEol: true
            });
            const fitAddon = new FitAddon();
            term.loadAddon(fitAddon);

            if (controller.placeholderEl?.parentElement) controller.placeholderEl.remove();
            controller.container.innerHTML = "";
            term.open(controller.container);
            requestAnimationFrame(() => {
                try { fitAddon.fit(); } catch { /* ignore */ }
            });

            controller.term = term;
            controller.fitAddon = fitAddon;

            const ro = new ResizeObserver(() => {
                try {
                    fitAddon.fit();
                } catch { /* ignore */ }
            });
            ro.observe(controller.container);
            controller.resizeObserver = ro;

            term.writeln(`${termColors.boldBlue("Flint Terminal")} - type ${termColors.green("help")} for commands`);
            this.printPrompt(term);

            term.onData((data: string) => this.handleData(controller, data));

            controller.setTitle("Terminal");
        } catch (e) {
            console.error("Failed to create terminal", e);
            controller.container.textContent = "Failed to load terminal: " + String(e);
        }
    }

    private static printPrompt(term: XTerm): void {
        term.write(`\r\n${termColors.boldGreen(termSymbols.prompt)} `);
    }

    private static rewriteNpmTonpm(command: string): string {
        return command.trim();
    }

    private static handleData(controller: TerminalWindowController, data: string): void {
        const term = controller.term;
        if (!term) return;

        switch (data) {
            case "\r": {
                const raw = controller.inputBuffer;
                const trimmed = raw.trim();
                if (trimmed === "clear") {
                    controller.history.push(raw);
                    controller.historyIndex = controller.history.length;
                    controller.inputBuffer = "";
                    void this.executeCommand(controller, "clear", raw);
                    return;
                }
                term.writeln("");
                if (trimmed.length > 0) {
                    controller.history.push(raw);
                    controller.historyIndex = controller.history.length;
                    const rewritten = this.rewriteNpmTonpm(raw);
                    void this.executeCommand(controller, rewritten, raw);
                } else {
                    this.printPrompt(term);
                }
                controller.inputBuffer = "";
                return;
            }
            case "\u007F":
            case "\b": {
                if (controller.inputBuffer.length > 0) {
                    controller.inputBuffer = controller.inputBuffer.slice(0, -1);
                    term.write("\b \b");
                }
                return;
            }
            case "\u0003": {
                term.writeln("^C");
                controller.inputBuffer = "";
                this.printPrompt(term);
                return;
            }
            case "\u000c": {
                term.clear();
                this.printPrompt(term);
                return;
            }
            case "\x1b[A": {
                if (controller.history.length > 0 && controller.historyIndex > 0) {
                    while (controller.inputBuffer.length > 0) {
                        term.write("\b \b");
                        controller.inputBuffer = controller.inputBuffer.slice(0, -1);
                    }
                    controller.historyIndex -= 1;
                    const h = controller.history[controller.historyIndex] ?? "";
                    controller.inputBuffer = h;
                    term.write(h);
                }
                return;
            }
            case "\x1b[B": {
                if (controller.historyIndex < controller.history.length - 1) {
                    while (controller.inputBuffer.length > 0) { term.write("\b \b"); controller.inputBuffer = controller.inputBuffer.slice(0, -1); }
                    controller.historyIndex += 1;
                    const h = controller.history[controller.historyIndex] ?? "";
                    controller.inputBuffer = h;
                    term.write(h);
                } else if (controller.historyIndex === controller.history.length - 1) {
                    while (controller.inputBuffer.length > 0) { term.write("\b \b"); controller.inputBuffer = controller.inputBuffer.slice(0, -1); }
                    controller.historyIndex = controller.history.length;
                    controller.inputBuffer = "";
                }
                return;
            }
        }

        if (data.startsWith("\x1b")) return;
        controller.inputBuffer += data;
        term.write(data);
    }

    private static async executeCommand(controller: TerminalWindowController, rewritten: string, raw: string): Promise<void> {
        const term = controller.term;
        if (!term) return;
        const [cmd, ...args] = rewritten.split(/\s+/).filter(Boolean);
        const rawCmd = raw.trim().split(/\s+/)[0]?.toLowerCase() ?? "";

        if (!cmd) { this.printPrompt(term); return; }

        switch (cmd.toLowerCase()) {
            case "help":
                term.writeln("Available commands:");
                term.writeln(`  ${termColors.yellow("help")}                       Show this help`);
                term.writeln(`  ${termColors.yellow("clear")}                      Clear terminal`);
                term.writeln(`  ${termColors.yellow("ls [path]")}                  List directory (mirrors Assets)`);
                term.writeln(`  ${termColors.yellow("cat <file>")}                 Show file content`);
                term.writeln(`  ${termColors.yellow("echo <txt> > <file>")}        Write text to file`);
                term.writeln(`  ${termColors.yellow("npm add <pkg[@ver]>")}        Install package (npm alias -> npm)`);
                term.writeln(`  ${termColors.yellow("npm i[nstall]")}              Install all deps from package.json`);
                term.writeln(`  ${termColors.yellow("npm rm|remove|un <pkg>")}     Remove package`);
                term.writeln(`  ${termColors.yellow("npm up[date] [pkg]")}         Update packages`);
                term.writeln(`  ${termColors.yellow("npm ls|list")}                List installed packages`);
                term.writeln(`  ${termColors.yellow("npm info|view <pkg>")}        Show registry info`);
                term.writeln(`  ${termColors.yellow("npm outdated")}               Check outdated`);
                term.writeln(`  ${termColors.yellow("npm why <pkg>")}              Explain why installed`);
                term.writeln(`  ${termColors.yellow("npm run <script>")}           Run package script`);
                term.writeln(`  ${termColors.yellow("npm exec|dlx <cmd>")}         Execute package binary`);
                term.writeln(`  ${termColors.yellow("npm create <tmpl>")}          Create from template`);
                term.writeln(`  ${termColors.yellow("npm init")}                   Init package.json`);
                term.writeln(`  ${termColors.yellow("npm audit")}                  Security audit`);
                term.writeln(`  ${termColors.yellow("npm -v|--version")}           Show version`);
                term.writeln(`  ${termColors.yellow("npm ...")}                    Alias to npm`);
                term.writeln(`  ${termColors.yellow("npx ...")}                    Alias to npm dlx`);
                this.printPrompt(term);
                break;
            case "clear":
                try { term.write(termColors.clearScreen); } catch { /* ignore */ }
                try { term.clear(); } catch { /* ignore */ }
                try { term.write(termColors.clearScrollback); } catch { /* ignore */ }
                this.printPrompt(term);
                break;
            case "ls":
            case "dir": {
                const target = args[0] ?? "";
                try {
                    const entries = await System.fileSystem.listDirEntries(target);
                    if (entries.length === 0) term.writeln("(empty)");
                    else {
                        for (const e of entries) {
                            const name = e.name + (e.kind === "directory" ? "/" : "");
                            term.writeln(e.kind === "directory" ? termColors.boldBlue(name) : name);
                        }
                    }
                } catch (e) {
                    term.writeln(termColors.red(`ls: ${String(e)}`));
                }
                this.printPrompt(term);
                break;
            }
            case "cat": {
                const file = args[0];
                if (!file) { term.writeln("usage: cat <file>"); this.printPrompt(term); break; }
                try {
                    const text = await System.fileSystem.readTextFile(file);
                    term.writeln(text);
                } catch (e) {
                    term.writeln(termColors.red(`cat: ${String(e)}`));
                }
                this.printPrompt(term);
                break;
            }
            case "echo": {
                const rawLine = rewritten.slice(4).trim();
                const redirectIdx = rawLine.lastIndexOf(">");
                if (redirectIdx !== -1) {
                    const text = rawLine.slice(0, redirectIdx).trim().replace(/^["']|["']$/g, "");
                    const file = rawLine.slice(redirectIdx + 1).trim();
                    try {
                        await System.fileSystem.writeTextFile(file, text + "\n");
                        term.writeln(`wrote ${file}`);
                    } catch (e) {
                        term.writeln(termColors.red(`echo: ${String(e)}`));
                    }
                } else {
                    term.writeln(rawLine);
                }
                this.printPrompt(term);
                break;
            }
            case "npm":
                await this.handlenpmCommand(controller, rewritten, raw);
                break;
            default: {
                if (cmd === "npm" || rawCmd === "npm" || rawCmd === "npx") {
                    await this.handlenpmCommand(controller, rewritten, raw);
                } else {
                    term.writeln(`${termColors.red(`command not found: ${cmd}`)}  (type help)`);
                    this.printPrompt(term);
                }
            }
        }
    }

    private static async handlenpmCommand(controller: TerminalWindowController, rewritten: string, _raw: string): Promise<void> {
        const term = controller.term;
        if (!term) return;

        const normalized = rewritten.trim();
        if (!normalized.startsWith("npm")) { term.writeln(termColors.red("unknown npm command")); this.printPrompt(term); return; }

        const withoutnpm = normalized.replace(/^npm\s*/, "");
        const [sub, ...rest] = withoutnpm.split(/\s+/).filter(Boolean);
        const subLower = (sub ?? "").toLowerCase();
        const args = rest;

        if (!subLower) {
            term.writeln(`npm 9.12.3 -- type ${termColors.green("help")} for commands`);
            this.printPrompt(term);
            return;
        }

        if (["--version", "-v", "version"].includes(subLower)) {
            term.writeln("9.12.3");
            this.printPrompt(term);
            return;
        }
        if (["help", "--help", "-h"].includes(subLower)) {
            term.writeln("Available npm commands: add, install, remove, update, list, info, outdated, why, run, exec, dlx, create, init, audit");
            term.writeln(`Type ${termColors.green("help")} for full list`);
            this.printPrompt(term);
            return;
        }

        if (["add", "i", "install"].includes(subLower)) {
            const pkgs = args.map(p => p.replace(/^["']|["']$/g, "")).filter(Boolean);
            if (pkgs.length === 0 && (subLower === "install" || subLower === "i")) {
                term.writeln("Resolving dependencies from package.json...");
                try {
                    const pkgText = await System.fileSystem.readTextFile("package.json").catch(() => "{}");
                    const pkg = JSON.parse(pkgText) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
                    const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
                    const names = Object.keys(deps);
                    if (names.length === 0) term.writeln("(no dependencies)");
                    else for (const n of names) await NpmService.installSinglePackage(term, n, deps[n]?.replace(/^[\^~>=<\s]+/, ""));
                } catch (e) {
                    term.writeln(termColors.red(`failed to read package.json: ${String(e)}`));
                }
                term.writeln(termColors.green("npm install complete"));
                this.printPrompt(term);
                return;
            }
            for (const spec of pkgs) {
                const atIdx = spec.lastIndexOf("@");
                let name = spec;
                let ver: string | undefined;
                if (atIdx > 0) { name = spec.slice(0, atIdx); ver = spec.slice(atIdx + 1); }
                await NpmService.installSinglePackage(term, name, ver);
            }
            if (pkgs.length > 0) term.writeln(termColors.green(`done. ${pkgs.join(", ")} installed via npm`));
            this.printPrompt(term);
            return;
        }
        if (["remove", "rm", "uninstall", "un"].includes(subLower)) {
            await this.handlenpmRemove(term, args);
            this.printPrompt(term);
            return;
        }
        if (["update", "up", "upgrade"].includes(subLower)) {
            await this.handlenpmUpdate(term, args);
            this.printPrompt(term);
            return;
        }
        if (["list", "ls"].includes(subLower)) {
            await this.handlenpmList(term, args);
            this.printPrompt(term);
            return;
        }
        if (["info", "view", "show", "v"].includes(subLower)) {
            await this.handlenpmInfo(term, args);
            this.printPrompt(term);
            return;
        }
        if (["outdated"].includes(subLower)) {
            await this.handlenpmOutdated(term);
            this.printPrompt(term);
            return;
        }
        if (["why"].includes(subLower)) {
            await this.handlenpmWhy(term, args);
            this.printPrompt(term);
            return;
        }
        if (["run", "run-script", "exec", "dlx"].includes(subLower)) {
            await this.handlenpmRunExec(term, subLower, args);
            this.printPrompt(term);
            return;
        }
        if (["create"].includes(subLower)) {
            const tmpl = args[0] ?? "";
            if (!tmpl) { term.writeln("usage: npm create <template>"); }
            else { term.writeln(termColors.dim(`${termSymbols.arrow} npm create ${tmpl} ${termSymbols.arrow} npm dlx create-${tmpl}`)); await this.handlenpmRunExec(term, "dlx", [`create-${tmpl}`, ...args.slice(1)]); return; }
            this.printPrompt(term);
            return;
        }
        if (["init"].includes(subLower)) {
            await this.handlenpmInit(term);
            this.printPrompt(term);
            return;
        }
        if (["audit"].includes(subLower)) {
            term.writeln("audit: no vulnerabilities (browser stub)");
            this.printPrompt(term);
            return;
        }
        term.writeln(`${termColors.red(`unknown npm command: ${subLower}`)} (type help)`);
        this.printPrompt(term);
    }

    private static async handlenpmRemove(term: XTerm, pkgs: string[]): Promise<void> {
        const names = pkgs.map(p => p.replace(/^["']|["']$/g, "")).filter(Boolean);
        if (names.length === 0) { term.writeln("usage: npm remove <pkg> [...]"); return; }
        let pkgText = "{}";
        try { pkgText = await System.fileSystem.readTextFile("package.json"); } catch { /* ignore */ }
        let pkg: Record<string, unknown> & { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
        try { pkg = JSON.parse(pkgText); } catch { pkg = {}; }
        for (const name of names) {
            const clean = name.split("@")[0] ?? name;
            let removed = false;
            if (pkg.dependencies?.[clean]) { delete pkg.dependencies[clean]; removed = true; }
            if (pkg.devDependencies?.[clean]) { delete pkg.devDependencies[clean]; removed = true; }
            try { await System.fileSystem.deleteDir(`node_modules/${clean}`, true); } catch { try { await System.fileSystem.delete(`node_modules/${clean}/package.json`); } catch { } }
            term.writeln(removed ? termColors.green(`${termSymbols.minus} ${clean} removed`) : termColors.yellow(`${termSymbols.minus} ${clean} not in dependencies`) + " (removed node_modules if present)");
        }
        await System.fileSystem.writeTextFile("package.json", JSON.stringify(pkg, null, 2));
        CodeEditor.scheduleLibRefresh();
    }

    private static async handlenpmUpdate(term: XTerm, pkgs: string[]): Promise<void> {
        const names = pkgs.map(p => p.replace(/^["']|["']$/g, "")).filter(Boolean);
        let pkgText = "{}";
        try { pkgText = await System.fileSystem.readTextFile("package.json"); } catch { term.writeln("no package.json"); return; }
        let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
        try { pkg = JSON.parse(pkgText); } catch { term.writeln("invalid package.json"); return; }
        const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
        const targets = names.length > 0 ? names : Object.keys(deps);
        if (targets.length === 0) { term.writeln("(no dependencies to update)"); return; }
        for (const n of targets) {
            const clean = n.split("@")[0] ?? n;
            term.writeln(termColors.dim(`${termSymbols.arrow} npm update ${clean}`));
            await NpmService.installSinglePackage(term, clean);
        }
    }

    private static async handlenpmList(term: XTerm, _args: string[]): Promise<void> {
        let pkgText = "{}";
        try { pkgText = await System.fileSystem.readTextFile("package.json"); } catch { pkgText = "{}"; }
        let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
        try { pkg = JSON.parse(pkgText); } catch { pkg = {}; }
        const deps = pkg.dependencies ?? {};
        const devDeps = pkg.devDependencies ?? {};
        const all = { ...deps, ...devDeps };
        if (Object.keys(all).length === 0) { term.writeln("(no dependencies)"); return; }
        let installed: string[] = [];
        try {
            const entries = await System.fileSystem.listDirEntries("node_modules").catch(() => []);
            installed = entries.filter(e => e.kind === "directory").map(e => e.name);
        } catch { /* ignore */ }
        term.writeln(termColors.bold("dependencies:"));
        for (const [name, ver] of Object.entries(all)) {
            const isInstalled = installed.includes(name.split("/")[0] === "@" ? name.split("/").slice(0, 2).join("/") : name.split("/")[0]!);
            term.writeln(`  ${isInstalled ? termColors.green(termSymbols.installed) : termColors.red(termSymbols.notInstalled)} ${name}@${ver}${isInstalled ? "" : " (not installed)"}`);
        }
        if (installed.length > 0) term.writeln(`${termColors.bold("node_modules:")} ` + installed.join(", "));
    }

    private static async handlenpmInfo(term: XTerm, args: string[]): Promise<void> {
        const name = args[0]?.replace(/^["']|["']$/g, "");
        if (!name) { term.writeln("usage: npm info <pkg>[@version]"); return; }
        const clean = name.split("@")[0] ?? name;
        try {
            const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(clean)}/latest`, { headers: { Accept: "application/json" } });
            if (!res.ok) { term.writeln(termColors.red(`${clean}: not found`)); return; }
            const data = await res.json() as { name: string; version: string; description?: string; license?: string; homepage?: string; dist?: { tarball: string }; main?: string };
            term.writeln(`${termColors.bold(`${data.name}@${data.version}`)} ${data.description ?? ""}`);
            if (data.license) term.writeln(`license: ${data.license}`);
            if (data.homepage) term.writeln(`homepage: ${data.homepage}`);
            if (data.dist?.tarball) term.writeln(`tarball: ${data.dist.tarball}`);
            term.writeln(`main: ${data.main ?? "index.js"}`);
        } catch (e) {
            term.writeln(termColors.red(`info failed: ${String(e)}`));
        }
    }

    private static async handlenpmOutdated(term: XTerm): Promise<void> {
        let pkgText = "{}";
        try { pkgText = await System.fileSystem.readTextFile("package.json"); } catch { term.writeln("no package.json"); return; }
        let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
        try { pkg = JSON.parse(pkgText); } catch { term.writeln("invalid package.json"); return; }
        const deps = { ...(pkg.dependencies ?? {}), ...(pkg.devDependencies ?? {}) };
        if (Object.keys(deps).length === 0) { term.writeln("(no dependencies)"); return; }
        term.writeln(termColors.bold("Checking outdated..."));
        for (const [name, cur] of Object.entries(deps)) {
            try {
                const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(name)}/latest`);
                if (!res.ok) { term.writeln(`  ${name} ${cur} ${termSymbols.arrow} ?`); continue; }
                const data = await res.json() as { version: string };
                const latest = data.version;
                const curClean = String(cur).replace(/^[\^~>=<\s]+/, "");
                term.writeln(`  ${name} ${termColors.yellow(String(cur))} ${termSymbols.arrow} ${termColors.green(latest)}${curClean === latest ? " (up to date)" : ""}`);
            } catch {
                term.writeln(`  ${name} ${cur} ${termSymbols.arrow} (fetch failed)`);
            }
        }
    }

    private static async handlenpmWhy(term: XTerm, args: string[]): Promise<void> {
        const name = args[0]?.replace(/^["']|["']$/g, "");
        if (!name) { term.writeln("usage: npm why <pkg>"); return; }
        const clean = name.split("@")[0] ?? name;
        let pkgText = "{}";
        try { pkgText = await System.fileSystem.readTextFile("package.json"); } catch { pkgText = "{}"; }
        let pkg: { dependencies?: Record<string, string>; devDependencies?: Record<string, string> } = {};
        try { pkg = JSON.parse(pkgText); } catch { pkg = {}; }
        if (pkg.dependencies?.[clean]) term.writeln(`${clean}@${pkg.dependencies[clean]} — dependencies`);
        else if (pkg.devDependencies?.[clean]) term.writeln(`${clean}@${pkg.devDependencies[clean]} — devDependencies`);
        else term.writeln(`${clean} — not in package.json (maybe transitive)`);
        try {
            const exists = await System.fileSystem.fileExists(`node_modules/${clean}/package.json`);
            term.writeln(exists ? `installed in node_modules/${clean}` : `not installed in node_modules`);
        } catch { term.writeln(`not installed`); }
    }

    private static async handlenpmRunExec(term: XTerm, sub: string, args: string[]): Promise<void> {
        if (sub === "run" || sub === "run-script") {
            const script = args[0];
            if (!script) { term.writeln("usage: npm run <script>"); return; }
            let pkgText = "{}";
            try { pkgText = await System.fileSystem.readTextFile("package.json"); } catch { term.writeln("no package.json"); return; }
            let pkg: { scripts?: Record<string, string> } = {};
            try { pkg = JSON.parse(pkgText); } catch { term.writeln("invalid package.json"); return; }
            const cmd = pkg.scripts?.[script];
            if (!cmd) { term.writeln(termColors.red(`script not found: ${script}`)); if (pkg.scripts) term.writeln(`available: ${Object.keys(pkg.scripts).join(", ")}`); return; }
            term.writeln(termColors.dim(`> ${script}: ${cmd}`));
            term.writeln(`(browser stub — not executing shell, would run: ${cmd})`);
            return;
        }
        const bin = args[0] ?? "";
        if (!bin) { term.writeln(`usage: npm ${sub} <command> [args...]`); return; }
        term.writeln(termColors.dim(`${termSymbols.arrow} npm dlx ${args.join(" ")}`));
        const pkgName = bin.split("/")[0] ?? bin;
        if (pkgName && !pkgName.startsWith("-")) {
            try {
                const res = await fetch(`https://registry.npmjs.org/${encodeURIComponent(pkgName)}/latest`);
                if (res.ok) {
                    const data = await res.json() as { version: string; bin?: Record<string, string> };
                    term.writeln(`would execute ${pkgName}@${data.version} (browser stub — no shell)`);
                    if (data.bin) term.writeln(`bin: ${JSON.stringify(data.bin)}`);
                    return;
                }
            } catch { /* ignore */ }
        }
        term.writeln(`(browser stub — exec not available, fetched info if possible)`);
    }

    private static async handlenpmInit(term: XTerm): Promise<void> {
        try {
            await System.fileSystem.readTextFile("package.json");
            term.writeln("package.json already exists");
            return;
        } catch { /* not exists -> create */ }
        const initPkg = {
            name: "flint-project",
            version: "0.1.0",
            description: "",
            main: "index.js",
            scripts: { dev: "flint dev", build: "flint build" },
            dependencies: {},
            devDependencies: {}
        };
        await System.fileSystem.writeTextFile("package.json", JSON.stringify(initPkg, null, 2));
        term.writeln(termColors.green("Wrote package.json"));
        CodeEditor.scheduleLibRefresh();
    }

    public static async installPackageByName(name: string, version?: string, term?: XTerm): Promise<boolean> {
        const t = term ?? { writeln: (s: string) => console.log(s.replace(/\x1b\[[0-9;]*m/g, "")), write: () => {}, clear: () => {}, writeln2: () => {} } as unknown as XTerm;
        try {
            await NpmService.installSinglePackage(t as unknown as { writeln: (s: string) => void }, name, version);
            return true;
        } catch {
            return false;
        }
    }

    public static async ensureDependenciesInstalled(options: { autoInstallAll?: boolean; term?: XTerm } = {}): Promise<{ installed: string[]; failed: string[] }> {
        return NpmService.ensureDependenciesInstalled(options.term as unknown as { writeln: (s: string) => void });
    }

    public static isMissingModuleError(message: string): string | null {
        const m = message.match(/Cannot find module ['"]([^'"]+)['"]|Cannot find module ['"]([^'"]+)['"] or its corresponding type declarations|Missing virtual file:\s*(\S+)|Failed to resolve.*['"]([^'"]+)['"]/);
        if (!m) return null;
        return m[1] ?? m[2] ?? m[3] ?? m[4] ?? null;
    }

    public static async handleMissingModuleFix(moduleName: string, term?: XTerm): Promise<boolean> {
        const clean = moduleName.split("/")[0] === "@" ? moduleName.split("/").slice(0, 2).join("/") : moduleName.split("/")[0]!;
        return this.installPackageByName(clean, undefined, term);
    }

    public static getActiveTerm(): XTerm | null {
        if (this.activeWindowId) {
            const c = this.windows.get(this.activeWindowId);
            if (c?.term) return c.term;
        }
        for (const c of this.windows.values()) if (c.term) return c.term;
        return null;
    }

    private static async finalizeInstall(term: XTerm | null, res: { installed: string[]; failed: string[] }, shouldRecompile: boolean): Promise<void> {
        if (res.installed.length > 0) {
            try {
                CodeEditor.scheduleLibRefresh();
            } catch { /* ignore */ }
            if (shouldRecompile) {
                try {
                    const { Builder } = await import("../project/builder");
                    await Builder.buildForEditor(false);
                } catch { /* ignore */ }
            }
        }
        if (term) {
            try {
                if (res.installed.length > 0) term.writeln(termColors.green(`${termSymbols.ok} installed ${res.installed.join(", ")}`));
                else term.writeln(termColors.dim("all dependencies up to date"));
                if (res.failed.length > 0) term.writeln(termColors.red(`${termSymbols.fail} failed ${res.failed.join(", ")}`));
                this.printPrompt(term);
            } catch { /* ignore */ }
        }
    }

    public static async runVisibleNpmInstall(packages: string[] | null, explicitTerm?: XTerm, opts: { recompile?: boolean } = {}): Promise<{ installed: string[]; failed: string[] }> {
        const shouldRecompile = opts.recompile ?? true;
        let term: XTerm | null = explicitTerm ?? this.getActiveTerm();
        const cmd = packages && packages.length > 0 ? `npm i ${packages.join(" ")}` : `npm install`;
        if (!term && this.spawnWindow) {
            try {
                this.spawnWindow("Terminal");
                for (let i = 0; i < 20; i++) {
                    await new Promise(r => setTimeout(r, 100));
                    term = this.getActiveTerm();
                    if (term) break;
                }
            } catch { /* ignore spawn errors */ }
        }
        if (term) {
            try { term.writeln(""); term.writeln(termColors.boldBlue(`$ ${cmd}`)); } catch { /* ignore */ }
            try {
                const mockCtrl: TerminalWindowController = { term, instanceId: "auto-install", container: null as unknown as HTMLElement, panelContainer: null, setTitle: () => {}, placeholderEl: null, started: true, inputBuffer: "", history: [], historyIndex: -1, fitAddon: null, resizeObserver: null };
                const rewritten = this.rewriteNpmTonpm(cmd);
                await this.handlenpmCommand(mockCtrl, rewritten, cmd);
                const check = await NpmService.ensureDependenciesInstalled();
                if (term) {
                    try { this.printPrompt(term); } catch { /* ignore */ }
                }
                await this.finalizeInstall(null, check, shouldRecompile);
                return check;
            } catch { /* fall through to ensureDependenciesInstalled */ }
        } else {
            console.log(`[Flint] ${cmd}`);
        }
        const res = await NpmService.ensureDependenciesInstalled(term as unknown as { writeln: (s: string) => void });
        if (packages && packages.length === 1 && res.installed.length === 0 && res.failed.length === 0) {
            const single = packages[0]!;
            const ok = await this.handleMissingModuleFix(single, term ?? undefined);
            if (ok) res.installed.push(single);
        }
        await this.finalizeInstall(term, res, shouldRecompile);
        return res;
    }

    public static destroyWindow(instanceId: string): void {
        const controller = this.windows.get(instanceId);
        if (!controller) return;
        try { controller.resizeObserver?.disconnect(); } catch { /* ignore */ }
        try { controller.term?.dispose?.(); } catch { /* ignore */ }
        this.windows.delete(instanceId);
        if (this.activeWindowId === instanceId) {
            const next = this.windows.keys().next();
            this.activeWindowId = next.done ? null : next.value;
        }
    }

    public static activateWindow(instanceId: string): void {
        const controller = this.windows.get(instanceId);
        if (!controller) return;
        this.activeWindowId = instanceId;
        try { controller.fitAddon?.fit(); } catch { /* ignore */ }
        try { controller.term?.focus(); } catch { /* ignore */ }
    }

    public static async notifyProjectOpened(): Promise<void> {
        for (const c of this.windows.values()) {
            if (!c.started && System.fileSystem.started) {
                if (c.placeholderEl?.parentElement) c.placeholderEl.remove();
                await this.ensureTerminalStarted(c);
            }
        }
    }
}
