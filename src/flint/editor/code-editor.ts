import { System } from "@flint/runtime/system";

type ExportResult = {
    defaultExport?: string;
    exports?: string[];
};

type ModuleExports = ExportResult & {
    path: string;
};

function parseExports(code: string): ExportResult {
    const result: ExportResult = { exports: [] };
    const tokens = code.split(/\s+/);
    let i = 0;

    while (i < tokens.length) {
        const token = tokens[i];

        // default export
        if (token === 'export' && tokens[i + 1] === 'default') {
            i += 2;
            const nextToken = tokens[i];
            if (nextToken) {
                // handle "export default function Foo" or "export default class Bar" or "export default expression"
                if (nextToken === 'function' || nextToken === 'class' || nextToken === 'const' || nextToken === 'let' || nextToken === 'var') {
                    const nameToken = tokens[i + 1];
                    if (nameToken) {
                        result.defaultExport = nameToken.replace(/[({]/g, ''); // remove any '(' or '{' in the name
                        i += 1;
                    }
                } else {
                    // inline default export (e.g., export default MyVar;)
                    result.defaultExport = nextToken.replace(/;/, '');
                }
            }
        }
        // named export
        else if (token === 'export') {
            const nextToken = tokens[i + 1];
            if (nextToken === '{') {
                // export { a, b, c }
                i += 2;
                while (i < tokens.length && tokens[i] !== '}') {
                    const name = tokens[i]!.replace(/,/, '');
                    if (name) result.exports!.push(name);
                    i++;
                }
            } else if (nextToken === 'function' || nextToken === 'class' || nextToken === 'const' || nextToken === 'let' || nextToken === 'var') {
                const nameToken = tokens[i + 2];
                if (nameToken) result.exports!.push(nameToken.replace(/[({;]/g, ''));
                i += 2;
            }
        }
        i++;
    }

    if (result.exports!.length === 0) delete result.exports;
    return result;
}

function toModuleSpecifier(filePath: string): string {
    const normalized = filePath.replace(/\\/g, "/");
    if (normalized.endsWith(".d.ts")) return normalized.slice(0, -".d.ts".length);
    return normalized.replace(/\.(ts|tsx|js|jsx|json)$/i, "");
}


export class CodeEditor {
    private static readonly html =
        `<!DOCTYPE html>
<html>

<head>
  <meta http-equiv="Content-Type" content="text/html;charset=utf-8" />
  <link rel="stylesheet" data-name="vs/editor/editor.main"
    href="https://unpkg.com/monaco-editor@0.34.0/min/vs/editor/editor.main.css" />
  <link rel="stylesheet" href="style.css">
</head>

<style>
  * {
    box-sizing: border-box;
  }

  html,
  body {
    height: 100%;
    margin: 0;
    font-family: Arial, Helvetica, sans-serif;
    font-size: 48px;
  }
</style>

<body>
  <div id="container" style="width: 100%; height: 100%;"></div>

  <script>
    var require = {
      paths: {
        vs: "https://unpkg.com/monaco-editor@0.34.0/min/vs",
      },
    };
  </script>
  <script src="https://unpkg.com/monaco-editor@0.34.0/min/vs/loader.js"></script>
  <script src="https://unpkg.com/monaco-editor@0.34.0/min/vs/editor/editor.main.nls.js"></script>
  <script src="https://unpkg.com/monaco-editor@0.34.0/min/vs/editor/editor.main.js"></script>

  <!-- <button>Run</button> -->
  <script type="module">
const editor = monaco.editor.create(document.getElementById("container"), {
  value: "",
  language: "typescript",
  automaticLayout: true
});

monaco.languages.typescript.typescriptDefaults.setCompilerOptions({
  target: monaco.languages.typescript.ScriptTarget.ESNext,
  module: monaco.languages.typescript.ModuleKind.ESNext,
  moduleResolution: monaco.languages.typescript.ModuleResolutionKind.NodeJs,
  strict: true,
  allowNonTsExtensions: true,
  experimentalDecorators: true,
  baseUrl: "./",
  paths: {
    "@flint/*": ["@flint/*"]
  }
});

monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions({
  noSemanticValidation: false,
  noSyntaxValidation: false,
  diagnosticCodesToIgnore: []
});

monaco.languages.typescript.typescriptDefaults.setMaximumWorkerIdleTime(2 * 60 * 1000);
monaco.editor.setTheme("vs-dark");

document.addEventListener("keydown", function (event) {
  if (event.ctrlKey && event.code === "KeyS") {
    event.preventDefault();
    save();
  }
}, true);

const loadedFiles = new Map();
const modulesByPath = new Map();

let completionsInstalled = false;

function addExtraLib(path, text) {
  loadedFiles.set(path, text);
  monaco.languages.typescript.typescriptDefaults.addExtraLib(text, path);
  monaco.languages.typescript.javascriptDefaults.addExtraLib(text, path);
}

function addExtraLibs(files) {
  for (const file of files) addExtraLib(file.path, file.text);
}

function upsertModules(modules) {
  if (!Array.isArray(modules)) return;
  for (const mod of modules) {
    if (!mod || typeof mod.path !== "string") continue;
    modulesByPath.set(mod.path, mod);
  }
}

function isInImportPath(model, position) {
  const line = model.getLineContent(position.lineNumber);
  const prefix = line.slice(0, Math.max(0, position.column - 1));
  return /(?:\\bfrom\\s*|\\bimport\\s*)(["'])([^"']*)$/.test(prefix);
}

function computeImportInsertRange(model) {
  const lineCount = model.getLineCount();
  let lineNumber = 1;

  while (lineNumber <= lineCount) {
    const line = model.getLineContent(lineNumber);
    if (/^\\s*$/.test(line) || /^\\s*\\/\\//.test(line)) {
      lineNumber++;
      continue;
    }
    if (/^\\s*import\\b/.test(line)) {
      lineNumber++;
      continue;
    }
    break;
  }

  return { startLineNumber: lineNumber, startColumn: 1, endLineNumber: lineNumber, endColumn: 1 };
}

function hasImport(model, modulePath, kind, name) {
  const head = model.getValueInRange({
    startLineNumber: 1,
    startColumn: 1,
    endLineNumber: Math.min(200, model.getLineCount()),
    endColumn: 1
  });

  if (kind === "module") {
    const escapedPath = escapeRegExp(modulePath);
    return new RegExp("\\bfrom\\s*[\\x27\\x22]" + escapedPath + "[\\x27\\x22]").test(head)
      || new RegExp("\\bimport\\s*[\\x27\\x22]" + escapedPath + "[\\x27\\x22]").test(head);
  }

  if (kind === "default") {
    const escapedName = escapeRegExp(name);
    const escapedPath = escapeRegExp(modulePath);
    return new RegExp("\\bimport\\s+" + escapedName + "\\s*(,\\s*\\{[^}]*\\}\\s*)?from\\s*[\\x27\\x22]" + escapedPath + "[\\x27\\x22]").test(head);
  }

  // named
  {
    const escapedName = escapeRegExp(name);
    const escapedPath = escapeRegExp(modulePath);
    return new RegExp("\\bimport\\s*\\{[^}]*\\b" + escapedName + "\\b[^}]*\\}\\s*from\\s*[\\x27\\x22]" + escapedPath + "[\\x27\\x22]").test(head);
  }
}

function escapeRegExp(text) {
  return String(text).replace(/[.*+?^{}$()|[\\]\\\\]/g, "\\\\$&");
}

function ensureCompletionsInstalled() {
  if (completionsInstalled) return;
  completionsInstalled = true;

  const languages = ["typescript", "javascript"];

  for (const language of languages) {
    // Import path completions
    monaco.languages.registerCompletionItemProvider(language, {
      triggerCharacters: ["'", '"', "/", "\\\\"],
      provideCompletionItems(model, position) {
        const line = model.getLineContent(position.lineNumber);
        const prefix = line.slice(0, Math.max(0, position.column - 1));
        const match = prefix.match(/(?:\\bfrom\\s*|\\bimport\\s*)(["'])([^"']*)$/);
        if (!match) return { suggestions: [] };

        const typed = match[2] ?? "";
        const normalizedTyped = typed.replace(/\\\\\\\\/g, "/");
        const startColumn = position.column - typed.length;
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn,
          endColumn: position.column
        };

        const seen = new Set();
        const suggestions = [];

        for (const mod of modulesByPath.values()) {
          const modulePath = mod.path;
          if (typeof modulePath !== "string") continue;
          if (normalizedTyped && !modulePath.startsWith(normalizedTyped)) continue;
          if (seen.has(modulePath)) continue;
          seen.add(modulePath);

          suggestions.push({
            label: modulePath,
            kind: monaco.languages.CompletionItemKind.Module,
            insertText: modulePath,
            range,
            detail: hasImport(model, modulePath, "module") ? "Already imported" : "Module"
          });
        }

        return { suggestions };
      }
    });

    // Auto import completions for exported symbols
    monaco.languages.registerCompletionItemProvider(language, {
      provideCompletionItems(model, position) {
        if (isInImportPath(model, position)) return { suggestions: [] };

        const word = model.getWordUntilPosition(position);
        const range = {
          startLineNumber: position.lineNumber,
          endLineNumber: position.lineNumber,
          startColumn: word.startColumn,
          endColumn: word.endColumn
        };

        const insertRange = computeImportInsertRange(model);
        const suggestions = [];

        for (const mod of modulesByPath.values()) {
          if (!mod || typeof mod.path !== "string") continue;
          const modulePath = mod.path;

          if (typeof mod.defaultExport === "string" && mod.defaultExport.length > 0) {
            const name = mod.defaultExport;
            suggestions.push({
              label: name,
              kind: monaco.languages.CompletionItemKind.Class,
              insertText: name,
              detail: "Auto import default from '" + modulePath + "'",
              range,
              additionalTextEdits: hasImport(model, modulePath, "default", name)
                ? []
                : [{ range: insertRange, text: "import " + name + " from \\"" + modulePath + "\\";\\n" }]
            });
          }

          if (Array.isArray(mod.exports)) {
            for (const name of mod.exports) {
              if (typeof name !== "string" || name.length === 0) continue;
              suggestions.push({
                label: name,
                kind: monaco.languages.CompletionItemKind.Class,
                insertText: name,
                detail: "Auto import from '" + modulePath + "'",
                range,
                additionalTextEdits: hasImport(model, modulePath, "named", name)
                  ? []
                  : [{ range: insertRange, text: "import { " + name + " } from \\"" + modulePath + "\\";\\n" }]
              });
            }
          }
        }

        return { suggestions };
      }
    });
  }
}

ensureCompletionsInstalled();

window.addEventListener("message", async (e) => {
  if (e.data.type === "FLINT_SEND_TEXT_FILE") {
    editor.setValue(e.data.text);

    const model = editor.getModel();
    monaco.editor.setModelLanguage(model, e.data.language);
  }
  else if (e.data.type === "FLINT_ADD_EXTRA_LIBS") {
    addExtraLibs(e.data.files ?? []);
    upsertModules(e.data.modules ?? []);
    ensureCompletionsInstalled();
  }
});

window.opener?.postMessage({ type: "FLINT_READ_TEXT_FILE" }, "*");

function save() {
  window.opener?.postMessage({ type: "FLINT_WRITE_TEXT_FILE", text: editor.getValue() }, "*");
}
  </script>
</body>


</html>`;

    private static tab: Window;
    private static path: string = "";

    private constructor() { }

    private static typeNames: Record<string, string> = {
        "ts": "typescript",
        "js": "javascript",
        "json": "json"
    };

    static {
        window.addEventListener("message", async (e: MessageEvent) => {
            const path = e.data.path ?? this.path;
            if (e.data.type === "FLINT_READ_TEXT_FILE") {
                CodeEditor.loadAssetsFolder("assets").then(() => {
                    CodeEditor.loadFlintFolder("flint");
                });

                this.tab.postMessage({
                    type: "FLINT_SEND_TEXT_FILE",
                    text: await System.fileSystem.readTextFile(path),
                    language: this.typeNames[path.split(".").at(-1)]
                }, "*");
            }
            else if (e.data.type === "FLINT_WRITE_TEXT_FILE") {
                await System.fileSystem.writeTextFile(path, e.data.text);
            }
        });
    }

    public static openVirtualEditor(path: string) {
        const blob = new Blob([this.html], { type: "text/html" });
        this.path = path;

        this.tab = window.open(URL.createObjectURL(blob), "flint_code_editor")!;
    }

    public static addExtraLibs(files: { path: string; text: string }[]) {
        const modules: ModuleExports[] = files.map((file) => ({
            path: toModuleSpecifier(file.path),
            ...parseExports(file.text)
        }));

        this.tab?.postMessage({
            type: "FLINT_ADD_EXTRA_LIBS",
            files: files,
            modules
        }, "*");
    }

    public static async loadAssetsFolder(assetsFolderPath: string = "assets") {
        const files: { path: string; text: string }[] = [];

        const loadDirectory = async (dirPath: string, baseAlias: string = "") => {
            try {
                const entries = await System.fileSystem.listDir(dirPath);

                for (const entry of entries) {
                    const fullPath = `${dirPath}/${entry}`;
                    const isFile = entry.includes(".");

                    if (isFile) {
                        try {
                            const text = await System.fileSystem.readTextFile(fullPath);
                            const aliasPath = baseAlias ? `${baseAlias}/${entry}` : entry;
                            files.push({ path: aliasPath, text });
                        } catch (e) {
                            console.warn(`Failed to read file: ${fullPath}`, e);
                        }
                    } else {
                        // Recursively load subdirectories
                        const subAlias = baseAlias ? `${baseAlias}/${entry}` : entry;
                        await loadDirectory(fullPath, subAlias);
                    }
                }
            } catch (e) {
                console.warn(`Failed to read directory: ${dirPath}`, e);
            }
        };

        await loadDirectory(assetsFolderPath);
        this.addExtraLibs(files);
    }

    public static async loadFlintFolder(flintFolderPath: string = "flint") {
        const files: Array<{ path: string; text: string }> = [];

        const loadDirectory = async (dirPath: string, basePath: string = "") => {
            try {
                const entries = await System.fileSystem.listDir(dirPath);

                for (const entry of entries) {
                    const fullPath = `${dirPath}/${entry}`;
                    const isFile = entry.includes(".");

                    if (isFile) {
                        try {
                            const text = await System.fileSystem.readTextFile(fullPath);
                            const flintPath = basePath ? `${basePath}/${entry}` : entry;
                            files.push({ path: `@flint/${flintPath}`, text });
                        } catch (e) {
                            console.warn(`Failed to read file: ${fullPath}`, e);
                        }
                    } else {
                        // Recursively load subdirectories
                        const subPath = basePath ? `${basePath}/${entry}` : entry;
                        await loadDirectory(fullPath, subPath);
                    }
                }
            } catch (e) {
                console.warn(`Failed to read directory: ${dirPath}`, e);
            }
        };

        await loadDirectory(flintFolderPath);
        this.addExtraLibs(files);
    }
}
