import { BaseEditorWindow, type EditorWindowState, type WindowContext } from "../ui/window-framework";
import { LogProvider, type LogLevel, type LogEntry } from "../ui/log-provider";

const ALL_LEVELS: LogLevel[] = ["trace", "debug", "log", "info", "warn", "error"];

// --- ANSI (chalk) support ---
const ANSI_REGEX = /\x1b\[([0-9;]*)([A-Za-z])/g;

function stripAnsi(text: string): string {
    return text.replace(ANSI_REGEX, "");
}

const ANSI_COLORS: Record<number, string> = {
    0: "#000000", 1: "#cd3131", 2: "#0dbc79", 3: "#e5e510", 4: "#2472c8", 5: "#bc3fbc", 6: "#11a8cd", 7: "#e5e5e5"
};
const ANSI_BRIGHT: Record<number, string> = {
    0: "#666666", 1: "#f14c4c", 2: "#23d18b", 3: "#f5f543", 4: "#3c8eea", 5: "#d670d6", 6: "#29b8db", 7: "#ffffff"
};

function ansi256Color(n: number): string | null {
    if (n < 0 || n > 255) return null;
    if (n < 16) {
        const base = n % 8;
        const bright = n >= 8 && n < 16;
        return bright ? ANSI_BRIGHT[base] ?? null : ANSI_COLORS[base] ?? null;
    }
    if (n >= 16 && n <= 231) {
        const r = Math.floor((n - 16) / 36);
        const g = Math.floor(((n - 16) % 36) / 6);
        const b = (n - 16) % 6;
        const toHex = (v: number) => (v === 0 ? 0 : 55 + v * 40);
        return `rgb(${toHex(r)},${toHex(g)},${toHex(b)})`;
    }
    if (n >= 232 && n <= 255) {
        const v = 8 + (n - 232) * 10;
        return `rgb(${v},${v},${v})`;
    }
    return null;
}

function appendAnsiText(container: HTMLElement, text: string): void {
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    // Current style state
    let style: Record<string, string | undefined> = {};
    // Need fresh regex each call
    const re = new RegExp(ANSI_REGEX.source, "g");
    const flush = (end: number, s: Record<string, string | undefined>) => {
        const chunk = text.slice(lastIndex, end);
        if (!chunk) return;
        const span = document.createElement("span");
        span.textContent = chunk;
        for (const [k, v] of Object.entries(s)) {
            if (v !== undefined) (span.style as unknown as Record<string, string>)[k] = v;
        }
        container.appendChild(span);
    };
    while ((match = re.exec(text)) !== null) {
        flush(match.index, { ...style });
        const codesStr = match[1] ?? "";
        const cmd = match[2];
        if (cmd === "m") {
            const codes = codesStr === "" ? [0] : codesStr.split(";").map(v => v === "" ? 0 : Number(v));
            for (let i = 0; i < codes.length; i++) {
                const c = codes[i]!;
                if (c === 0) style = {};
                else if (c === 1) style.fontWeight = "bold";
                else if (c === 2) style.opacity = "0.7";
                else if (c === 3) style.fontStyle = "italic";
                else if (c === 4) style.textDecoration = "underline";
                else if (c === 9) style.textDecoration = "line-through";
                else if (c === 22) delete style.fontWeight;
                else if (c === 23) delete style.fontStyle;
                else if (c === 24) delete style.textDecoration;
                else if (c >= 30 && c <= 37) { const col = ANSI_COLORS[c - 30]; if (col) style.color = col; }
                else if (c === 39) delete style.color;
                else if (c >= 40 && c <= 47) { const col = ANSI_COLORS[c - 40]; if (col) style.backgroundColor = col; }
                else if (c === 49) delete style.backgroundColor;
                else if (c >= 90 && c <= 97) { const col = ANSI_BRIGHT[c - 90]; if (col) style.color = col; }
                else if (c >= 100 && c <= 107) { const col = ANSI_BRIGHT[c - 100]; if (col) style.backgroundColor = col; }
                else if (c === 38 || c === 48) {
                    const isFg = c === 38;
                    const next = codes[i + 1];
                    if (next === 5) {
                        const n = codes[i + 2];
                        if (n !== undefined) {
                            const col = ansi256Color(n);
                            if (col) {
                                if (isFg) style.color = col;
                                else style.backgroundColor = col;
                            }
                        }
                        i += 2;
                    } else if (next === 2) {
                        const r = codes[i + 2], g = codes[i + 3], b = codes[i + 4];
                        if (r !== undefined && g !== undefined && b !== undefined) {
                            const col = `rgb(${r},${g},${b})`;
                            if (isFg) style.color = col;
                            else style.backgroundColor = col;
                        }
                        i += 4;
                    }
                }
            }
        }
        // Handle cursor etc. codes ignored
        lastIndex = re.lastIndex;
    }
    flush(text.length, { ...style });
}

export default class LogWindow extends BaseEditorWindow {
    private static clearOnStartGlobal = false;
    private static clearOnStartListeners = new Set<() => void>();

    private container!: HTMLElement;
    private toolbar!: HTMLElement;
    private listEl!: HTMLElement;
    private filterState: Record<LogLevel, boolean> = {
        trace: true,
        debug: true,
        log: true,
        info: true,
        warn: true,
        error: true
    };
    private searchQuery = "";
    private clearOnStart = false;
    private renderRaf: number | null = null;
    private lastRenderedCount = 0;
    private lastFilterHash = "";

    public constructor(context: WindowContext) {
        super(context);
        this.root.className = "panel-content flint-log-panel";
        this.root.innerHTML = `
            <div class="flint-log-toolbar">
                <div class="flint-log-filters"></div>
                <sl-checkbox class="flint-log-clear-on-start" size="small">Clear on start</sl-checkbox>
                <div class="flint-log-actions">
                    <sl-input class="flint-log-search" placeholder="Filter..." size="small" clearable></sl-input>
                    <sl-button class="flint-log-clear" size="small">Clear</sl-button>
                </div>
            </div>
            <div class="flint-log-container"></div>
        `;
        this.container = this.query(".flint-log-container");
        this.toolbar = this.query(".flint-log-toolbar");
        this.clearOnStart = LogWindow.clearOnStartGlobal;
    }

    public override async initialize(): Promise<void> {
        const filtersHost = this.query(".flint-log-filters");
        // Dropdown with checkbox menu items for levels
        const dropdown = document.createElement("sl-dropdown") as HTMLElement & { closeOnSelect?: boolean };
        dropdown.setAttribute("close-on-select", "false");
        (dropdown as unknown as Record<string, unknown>)["closeOnSelect"] = false;
        const trigger = document.createElement("sl-button");
        trigger.setAttribute("slot", "trigger");
        trigger.setAttribute("size", "small");
        trigger.setAttribute("caret", "");
        trigger.innerHTML = `<sl-icon name="funnel" slot="prefix"></sl-icon> Levels`;
        dropdown.appendChild(trigger);
        const menu = document.createElement("sl-menu") as HTMLElement;
        // Keep dropdown open when toggling checkboxes
        menu.setAttribute("close-on-select", "false");
        for (const lvl of ALL_LEVELS) {
            const item = document.createElement("sl-menu-item") as HTMLElement & { type: string; checked: boolean; value: string };
            item.setAttribute("type", "checkbox");
            item.setAttribute("value", lvl);
            (item as unknown as Record<string, unknown>)["type"] = "checkbox";
            const shouldChecked = this.filterState[lvl];
            if (shouldChecked) {
                item.setAttribute("checked", "");
                (item as unknown as Record<string, unknown>)["checked"] = true;
            } else {
                item.removeAttribute("checked");
                (item as unknown as Record<string, unknown>)["checked"] = false;
            }
            item.dataset.level = lvl;
            // Show badge inside menu item
            item.innerHTML = `<span class="flint-log-badge flint-log-${lvl}">${lvl}</span>`;
            menu.appendChild(item);
            // Shoelace toggles checked automatically on click; listen for sl-change / click
            this.listen(item, "click", () => {
                // Delay to let Shoelace toggle checked
                setTimeout(() => {
                    const checkedAttr = item.hasAttribute("checked");
                    const propChecked = (item as unknown as Record<string, unknown>)["checked"] as boolean | undefined;
                    const isChecked = typeof propChecked === "boolean" ? propChecked : checkedAttr;
                    this.filterState[lvl] = !!isChecked;
                    this.render();
                }, 0);
            });
            // Also listen for sl-change if emitted
            this.listen(item as unknown as HTMLElement, "sl-change" as keyof HTMLElementEventMap, () => {
                const checked = (item as unknown as Record<string, unknown>)["checked"] as boolean;
                if (typeof checked === "boolean") {
                    this.filterState[lvl] = checked;
                    this.render();
                }
            });
        }
        dropdown.appendChild(menu);
        filtersHost.appendChild(dropdown);

        const search = this.query(".flint-log-search") as HTMLInputElement & { addEventListener: HTMLElement["addEventListener"] };
        this.listen(search, "sl-input" as keyof HTMLElementEventMap, () => {
            this.searchQuery = (search as unknown as { value: string }).value?.toLowerCase() ?? search.value.toLowerCase();
            this.render();
        });
        this.listen(search, "input", () => {
            this.searchQuery = search.value.toLowerCase();
            this.render();
        });

        const clearBtn = this.query(".flint-log-clear");
        this.listen(clearBtn, "click", () => {
            LogProvider.clear();
        });

        const clearOnStartCb = this.query(".flint-log-clear-on-start") as HTMLElement & { checked: boolean };
        // Sync UI with global state
        (clearOnStartCb as unknown as { checked: boolean }).checked = this.clearOnStart;
        if (LogWindow.clearOnStartGlobal) clearOnStartCb.setAttribute("checked", "");
        this.listen(clearOnStartCb, "sl-change" as keyof HTMLElementEventMap, () => {
            const checked = (clearOnStartCb as unknown as { checked: boolean }).checked;
            this.clearOnStart = !!checked;
            LogWindow.clearOnStartGlobal = this.clearOnStart;
            for (const l of LogWindow.clearOnStartListeners) l();
        });
        // Keep all Log windows in sync if one toggles
        const syncListener = () => {
            (clearOnStartCb as unknown as { checked: boolean }).checked = LogWindow.clearOnStartGlobal;
            if (LogWindow.clearOnStartGlobal) clearOnStartCb.setAttribute("checked", "");
            else clearOnStartCb.removeAttribute("checked");
            this.clearOnStart = LogWindow.clearOnStartGlobal;
        };
        LogWindow.clearOnStartListeners.add(syncListener);
        this.registerCleanup(() => LogWindow.clearOnStartListeners.delete(syncListener));

        const maybeClear = () => {
            if (LogWindow.clearOnStartGlobal) LogProvider.clear();
        };
        const runBtn = document.getElementById("run-button");
        if (runBtn) this.listen(runBtn, "click", () => {
            setTimeout(() => {
                const iconEl = document.querySelector("#run-button sl-icon") as HTMLElement & { name?: string } | null;
                const iconName = (iconEl as unknown as { name?: string })?.name ?? (iconEl?.getAttribute("name") as string | null);
                const didStart = iconName === "stop";
                if (didStart) maybeClear();
            }, 0);
        });

        this.listEl = this.container;
        this.listEl.classList.add("flint-log-list");

        this.registerCleanup(LogProvider.subscribe(() => this.scheduleRender()));
        this.render();
    }

    public override getControls() {
        return [
            {
                id: "clear-log",
                icon: "trash",
                title: "Clear",
                ariaLabel: "Clear logs",
                onClick: () => LogProvider.clear()
            }
        ] as const;
    }

    private scheduleRender(): void {
        if (this.renderRaf !== null) return;
        this.renderRaf = requestAnimationFrame(() => {
            this.renderRaf = null;
            this.render();
        });
    }

    private createRow(entry: LogEntry): HTMLElement {
        const row = document.createElement("div");
        row.className = `flint-log-row flint-log-${entry.level}`;
        row.dataset.level = entry.level;
        const time = document.createElement("span");
        time.className = "flint-log-time";
        time.textContent = new Date(entry.time).toLocaleTimeString();
        const badge = document.createElement("span");
        badge.className = `flint-log-badge flint-log-${entry.level}`;
        badge.textContent = entry.level;
        const msg = document.createElement("span");
        msg.className = "flint-log-message";
        appendAnsiText(msg, entry.message);
        row.appendChild(time);
        row.appendChild(badge);
        row.appendChild(msg);
        if (entry.count > 1) {
            const count = document.createElement("span");
            count.className = "flint-log-count";
            count.textContent = `×${entry.count}`;
            count.title = `Repeated ${entry.count} times`;
            row.appendChild(count);
        }
        if (entry.stack) {
            const stack = document.createElement("pre");
            stack.className = "flint-log-stack";
            appendAnsiText(stack, entry.stack);
            stack.style.display = "none";
            row.appendChild(stack);
            this.listen(row, "click", () => {
                stack.style.display = stack.style.display === "none" ? "block" : "none";
            });
            row.style.cursor = "pointer";
        }
        return row;
    }

    private render(): void {
        const entries = LogProvider.getEntries();
        const filterHash = JSON.stringify(this.filterState) + "|" + this.searchQuery;
        const filterChanged = filterHash !== this.lastFilterHash;
        const nearBottom = this.container.scrollTop + this.container.clientHeight >= this.container.scrollHeight - 40;
        const shouldAutoScroll = nearBottom || this.container.scrollHeight === 0;

        if (filterChanged) {
            this.lastFilterHash = filterHash;
            this.lastRenderedCount = 0;
            this.listEl.replaceChildren();
        }

        const filtered = entries.filter(e => {
            if (!this.filterState[e.level]) return false;
            if (this.searchQuery === "") return true;
            const plain = stripAnsi(e.message).toLowerCase();
            return plain.includes(this.searchQuery) || e.level.includes(this.searchQuery);
        });

        if (filtered.length === 0) {
            this.listEl.replaceChildren();
            const empty = document.createElement("div");
            empty.className = "flint-log-empty";
            empty.textContent = entries.length === 0 ? "No logs yet." : "No logs match filter.";
            this.listEl.appendChild(empty);
            this.lastRenderedCount = 0;
            return;
        }

        if (filterChanged) {
            const frag = document.createDocumentFragment();
            for (const entry of filtered) frag.appendChild(this.createRow(entry));
            this.listEl.replaceChildren(frag);
            this.lastRenderedCount = filtered.length;
        } else {
            if (this.lastRenderedCount < filtered.length) {
                const frag = document.createDocumentFragment();
                for (let i = this.lastRenderedCount; i < filtered.length; i++) frag.appendChild(this.createRow(filtered[i]!));
                const emptyEl = this.listEl.querySelector(".flint-log-empty");
                if (emptyEl) emptyEl.remove();
                this.listEl.appendChild(frag);
                this.lastRenderedCount = filtered.length;
            } else if (filtered.length === this.lastRenderedCount && filtered.length > 0) {
                const lastEntry = filtered[filtered.length - 1]!;
                const lastRow = this.listEl.lastElementChild as HTMLElement | null;
                if (lastRow && !lastRow.classList.contains("flint-log-empty")) {
                    const countEl = lastRow.querySelector(".flint-log-count") as HTMLElement | null;
                    if (lastEntry.count > 1) {
                        if (countEl) {
                            const expected = `×${lastEntry.count}`;
                            if (countEl.textContent !== expected) {
                                countEl.textContent = expected;
                                countEl.title = `Repeated ${lastEntry.count} times`;
                            }
                        } else {
                            const c = document.createElement("span");
                            c.className = "flint-log-count";
                            c.textContent = `×${lastEntry.count}`;
                            c.title = `Repeated ${lastEntry.count} times`;
                            lastRow.appendChild(c);
                        }
                    } else if (countEl) {
                        countEl.remove();
                    }
                    const timeEl = lastRow.querySelector(".flint-log-time") as HTMLElement | null;
                    if (timeEl) timeEl.textContent = new Date(lastEntry.time).toLocaleTimeString();
                }
            } else if (entries.length < this.lastRenderedCount) {
                const frag = document.createDocumentFragment();
                for (const entry of filtered) frag.appendChild(this.createRow(entry));
                this.listEl.replaceChildren(frag);
                this.lastRenderedCount = filtered.length;
            } else if (entries.length === 0) {
                this.listEl.replaceChildren();
                this.lastRenderedCount = 0;
            }
        }

        if (shouldAutoScroll) {
            requestAnimationFrame(() => {
                this.container.scrollTop = this.container.scrollHeight;
            });
        }
    }

    public override serializeState(): EditorWindowState {
        return {
            filters: { ...this.filterState },
            search: this.searchQuery,
            clearOnStart: this.clearOnStart
        };
    }

    public override restoreState(state: EditorWindowState): void {
        if (!state) return;
        const s = state as { filters?: Record<string, boolean>; search?: string; clearOnStart?: boolean };
        if (s.filters) {
            for (const lvl of ALL_LEVELS) {
                if (typeof s.filters[lvl] === "boolean") this.filterState[lvl] = s.filters[lvl]!;
            }
        }
        if (typeof s.search === "string") this.searchQuery = s.search;
        if (typeof s.clearOnStart === "boolean") {
            this.clearOnStart = s.clearOnStart;
            LogWindow.clearOnStartGlobal = s.clearOnStart;
        }
        // If UI already initialized, sync checkboxes
        try {
            const menuItems = this.root.querySelectorAll("sl-menu-item[data-level]") as NodeListOf<HTMLElement & { checked?: boolean }>;
            for (const item of menuItems) {
                const lvl = (item.dataset.level as LogLevel | undefined);
                if (lvl && typeof s.filters?.[lvl] === "boolean") {
                    const should = !!s.filters[lvl];
                    if (should) {
                        item.setAttribute("checked", "");
                        (item as unknown as Record<string, unknown>)["checked"] = true;
                    } else {
                        item.removeAttribute("checked");
                        (item as unknown as Record<string, unknown>)["checked"] = false;
                    }
                }
            }
            const search = this.root.querySelector(".flint-log-search") as HTMLInputElement | null;
            if (search && typeof s.search === "string") (search as unknown as { value: string }).value = s.search;
            const cb = this.root.querySelector(".flint-log-clear-on-start") as HTMLElement & { checked?: boolean } | null;
            if (cb && typeof s.clearOnStart === "boolean") {
                (cb as unknown as { checked: boolean }).checked = !!s.clearOnStart;
                if (s.clearOnStart) cb.setAttribute("checked", "");
                else cb.removeAttribute("checked");
            }
        } catch { /* ignore if not yet initialized */ }
    }
}
