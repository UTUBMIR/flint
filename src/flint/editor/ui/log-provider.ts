export type LogLevel = "trace" | "debug" | "log" | "info" | "warn" | "error";

export type LogEntry = {
    id: number;
    level: LogLevel;
    args: unknown[];
    message: string;
    time: number;
    stack?: string | undefined;
    count: number;
};

type Listener = () => void;

function stringifyArg(arg: unknown): string {
    if (typeof arg === "string") return arg;
    if (arg instanceof Error) return arg.message + (arg.stack ? "\n" + arg.stack : "");
    try {
        if (typeof arg === "object" && arg !== null) return JSON.stringify(arg, null, 2);
    } catch { /* ignore */ }
    return String(arg);
}

function formatArgs(args: unknown[]): string {
    return args.map(stringifyArg).join(" ");
}

export class LogProvider {
    private static entries: LogEntry[] = [];
    private static nextId = 1;
    private static maxEntries = 1000;
    private static listeners = new Set<Listener>();
    private static installed = false;
    private static originals = new Map<string, (...args: unknown[]) => void>();

    public static install(): void {
        if (LogProvider.installed) return;
        LogProvider.installed = true;

        const levels: LogLevel[] = ["trace", "debug", "log", "info", "warn", "error"];
        for (const level of levels) {
            const orig = (console as unknown as Record<string, unknown>)[level];
            if (typeof orig === "function") {
                LogProvider.originals.set(level, orig as (...args: unknown[]) => void);
                (console as unknown as Record<string, unknown>)[level] = (...args: unknown[]) => {
                    const fn = LogProvider.originals.get(level);
                    try { fn?.apply(console, args as never); } catch { /* ignore */ }
                    LogProvider.push(level, args);
                };
            }
        }
        // Also wrap console.clear to clear our store if desired? Keep separate.

        // Capture uncaught errors that might not go through console.error
        window.addEventListener("error", (e) => {
            const msg = e.message || String(e.error ?? "Unknown error");
            LogProvider.push("error", [msg], e.error instanceof Error ? e.error.stack : undefined);
        });
        window.addEventListener("unhandledrejection", (e) => {
            const reason = e.reason;
            const msg = reason instanceof Error ? reason.message : String(reason ?? "Unhandled rejection");
            LogProvider.push("error", [msg], reason instanceof Error ? reason.stack : undefined);
        });
    }

    private static push(level: LogLevel, args: unknown[], stack?: string): void {
        const message = formatArgs(args);
        // Deduplicate consecutive identical messages — show count instead of repeating
        const last = LogProvider.entries[LogProvider.entries.length - 1];
        if (last && last.level === level && last.message === message && (last.stack ?? "") === (stack ?? "")) {
            last.count += 1;
            last.time = Date.now();
            // Update args to latest (keep last)
            last.args = args;
            for (const l of LogProvider.listeners) {
                try { l(); } catch { /* ignore */ }
            }
            return;
        }
        const entry: LogEntry = {
            id: LogProvider.nextId++,
            level,
            args,
            message,
            time: Date.now(),
            stack,
            count: 1
        };
        // Try to capture stack for error/warn if not provided
        if (!stack && (level === "error" || level === "warn")) {
            try {
                const err = new Error();
                if (err.stack) entry.stack = err.stack.split("\n").slice(2).join("\n");
            } catch { /* ignore */ }
        }
        LogProvider.entries.push(entry);
        if (LogProvider.entries.length > LogProvider.maxEntries) {
            LogProvider.entries.shift();
        }
        for (const l of LogProvider.listeners) {
            try { l(); } catch { /* ignore */ }
        }
    }

    public static getEntries(): readonly LogEntry[] {
        return LogProvider.entries;
    }

    public static clear(): void {
        LogProvider.entries = [];
        for (const l of LogProvider.listeners) {
            try { l(); } catch { /* ignore */ }
        }
    }

    public static subscribe(listener: Listener): () => void {
        LogProvider.listeners.add(listener);
        return () => LogProvider.listeners.delete(listener);
    }

    public static log(level: LogLevel, ...args: unknown[]): void {
        const orig = LogProvider.originals.get(level);
        if (orig) {
            try { orig.apply(console, args as never); } catch { /* ignore */ }
        } else {
            try { (console as unknown as Record<string, unknown>)[level] = (...a: unknown[]) => LogProvider.push(level, a); } catch { /* ignore */ }
            LogProvider.push(level, args);
            return;
        }
        LogProvider.push(level, args);
    }
}
