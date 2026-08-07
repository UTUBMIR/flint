import type SlDialog from "@shoelace-style/shoelace/dist/components/dialog/dialog.component.js";
import type { IMarker } from "monaco-editor";
import { CodeEditor } from "../ui/code-editor";
import { ProblemsStore } from "./problems-store";
import { EngineErrorExplanations, interpolateExplanation, type AutofixFixContext } from "./engine-error-explanations";

type ReportRow = {
    kind: "code" | "runtime";
    path?: string;
    line?: number;
    message: string;
    stack?: string;
    severity: number;
    when?: number;
};

export async function openProblemsReport(): Promise<void> {
    const rows: ReportRow[] = [];

    for (const marker of getOpenFileMarkers()) {
        const path = CodeEditor.getFileForModelUri(marker.resource.toString());
        if (!path) {
            continue;
        }

        rows.push({
            kind: "code",
            path,
            line: marker.startLineNumber,
            message: humanizeMarker(marker),
            severity: marker.severity
        });
    }

    for (const problem of ProblemsStore.getRuntimeErrors()) {
        const row: ReportRow = { kind: "runtime", message: problem.message, severity: 8, when: problem.when };
        if (problem.stack !== undefined) {
            row.stack = problem.stack;
        }
        rows.push(row);
    }

    const dialog = document.getElementById("problems-window") as SlDialog;
    renderReport(dialog, rows);
    dialog.show();
}

function getOpenFileMarkers(): IMarker[] {
    const monaco = window.monaco;
    if (!monaco) {
        return [];
    }

    const markers: IMarker[] = [];
    for (const model of monaco.editor.getModels()) {
        markers.push(...monaco.editor.getModelMarkers({ resource: model.uri, owner: "typescript" }));
    }
    return markers;
}

function markerCode(marker: IMarker): string | number {
    const code = marker.code;
    return typeof code === "object" && code !== null ? code.value : code;
}

function extractQuoted(text: string): string | undefined {
    return text.match(/['"]([^'"]+)['"]/)?.[1];
}

function humanizeMarker(marker: IMarker): string {
    const code = String(markerCode(marker));
    const message = marker.message;

    if (code === "2307" || code === "2792") {
        const name = extractQuoted(message);
        return name ? `Cannot find the module/file "${name}". Check that the import path is correct.` : message;
    }
    if (code === "2304") {
        const name = extractQuoted(message);
        return name ? `"${name}" is not defined. Import it or check the spelling.` : message;
    }
    if (code === "2552" || code === "2580") {
        const matches = message.match(/['"]([^'"]+)['"][\s\S]*?['"]([^'"]+)['"]/);
        if (matches && matches[1] && matches[2]) {
            return `"${matches[1]}" is not defined. Did you mean "${matches[2]}"?`;
        }
        const name = extractQuoted(message);
        return name ? `"${name}" is not defined. Did you mean something else?` : message;
    }
    if (code === "6133" || code === "6196" || code === "6198") {
        const name = extractQuoted(message);
        return name ? `"${name}" is declared but never used.` : message;
    }

    return message;
}

function renderReport(dialog: SlDialog, rows: ReportRow[]): void {
    const container = document.getElementById("problems-content")!;
    container.replaceChildren();

    if (rows.length === 0) {
        const empty = document.createElement("p");
        empty.className = "problems-empty";
        empty.textContent = "IDK: ¯\\_(ツ)_/¯";
        container.appendChild(empty);
        return;
    }

    const codeRows = rows.filter(row => row.kind === "code");
    const runtimeRows = rows.filter(row => row.kind === "runtime");

    if (codeRows.length > 0) {
        container.appendChild(sectionHeader(`Code problems (${codeRows.length})`));
        const list = document.createElement("div");
        list.className = "problems-list";
        for (const row of codeRows) {
            list.appendChild(codeProblemRow(row));
        }
        container.appendChild(list);
    }

    if (runtimeRows.length > 0) {
        container.appendChild(sectionHeader(`Runtime errors (${runtimeRows.length})`));
        const list = document.createElement("div");
        list.className = "problems-list";
        for (const row of runtimeRows) {
            list.appendChild(runtimeProblemRow(row));
        }
        container.appendChild(list);

        const clearButton = document.createElement("sl-button");
        clearButton.size = "small";
        clearButton.textContent = "Clear runtime errors";
        clearButton.addEventListener("click", () => {
            ProblemsStore.clearRuntimeErrors();

            const runtimeRows = ProblemsStore.getRuntimeErrors().map(problem => {
                const row: ReportRow = { kind: "runtime", message: problem.message, severity: 8, when: problem.when };
                if (problem.stack !== undefined) {
                    row.stack = problem.stack;
                }
                return row;
            });

            renderReport(dialog, [...codeRows, ...runtimeRows]);
        });
        container.appendChild(clearButton);
    }
}

function sectionHeader(text: string): HTMLElement {
    const header = document.createElement("div");
    header.className = "problems-section-header";
    header.textContent = text;
    return header;
}

function codeProblemRow(row: ReportRow): HTMLElement {
    const rowEl = document.createElement("div");
    rowEl.className = "problems-row";
    rowEl.addEventListener("click", () => {
        if (row.path) {
            void CodeEditor.openFileAtPosition(row.path, row.line ?? 1);
        }
    });

    const location = document.createElement("span");
    location.className = "problems-location";
    location.textContent = `${row.path}:${row.line}`;

    const message = document.createElement("span");
    message.className = "problems-message";
    message.textContent = row.message;

    rowEl.appendChild(location);
    rowEl.appendChild(message);
    return rowEl;
}

function runtimeProblemRow(row: ReportRow): HTMLElement {
    const rowEl = document.createElement("div");
    rowEl.className = "problems-row problems-row-error";

    const meta = document.createElement("span");
    meta.className = "problems-meta";
    meta.textContent = row.when ? new Date(row.when).toLocaleTimeString() : "";

    const message = document.createElement("span");
    message.className = "problems-message";
    message.textContent = row.message;

    rowEl.appendChild(meta);
    rowEl.appendChild(message);

    const explanation = EngineErrorExplanations.find(row.message, row.stack);
    if (explanation) {
        const { entry, message, groups, stack } = explanation;
        rowEl.appendChild(explanationBlock(entry.title, interpolateExplanation(entry.explanation, groups), entry.tips));

        const fixContext: AutofixFixContext = { message, groups };
        if (stack !== undefined) {
            fixContext.stack = stack;
        }
        const fixes = entry.fix?.(fixContext) ?? [];
        if (fixes.length > 0) {
            const fixesEl = document.createElement("div");
            fixesEl.className = "problems-fixes";
            for (const action of fixes) {
                const button = document.createElement("sl-button");
                button.size = "small";
                button.textContent = action.label;
                button.addEventListener("click", () => {
                    void action.apply();
                });
                fixesEl.appendChild(button);
            }
            rowEl.appendChild(fixesEl);
        }
    }

    if (row.stack) {
        const details = document.createElement("details");
        const summary = document.createElement("summary");
        summary.textContent = "Stack trace";
        const stack = document.createElement("pre");
        stack.className = "problems-stack";
        stack.textContent = row.stack;
        details.appendChild(summary);
        details.appendChild(stack);
        rowEl.appendChild(details);
    }

    return rowEl;
}

function explanationBlock(title: string, text: string, tips: string[]): HTMLElement {
    const block = document.createElement("div");
    block.className = "problems-explanation";

    const titleEl = document.createElement("div");
    titleEl.className = "problems-explanation-title";
    titleEl.textContent = title;

    const textEl = document.createElement("div");
    textEl.className = "problems-explanation-text";
    textEl.textContent = text;

    block.appendChild(titleEl);
    block.appendChild(textEl);

    if (tips.length > 0) {
        const list = document.createElement("ul");
        list.className = "problems-explanation-tips";
        for (const tip of tips) {
            const item = document.createElement("li");
            item.textContent = tip;
            list.appendChild(item);
        }
        block.appendChild(list);
    }

    return block;
}