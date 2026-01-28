import { System } from "@flint/runtime/system";

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
let editor = monaco.editor.create(document.getElementById("container"), {
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

document.addEventListener("keydown", async function (event) {
    if (event.ctrlKey && event.code === "KeyS") {
        event.preventDefault();
        save();
    }
}, true);

const loadedFiles = new Map();

function addExtraLib(path, text) {
    loadedFiles.set(path, text);
    monaco.languages.typescript.typescriptDefaults.addExtraLib(text, path);
    monaco.languages.typescript.javascriptDefaults.addExtraLib(text, path);
}

function addExtraLibs(files) {
    files.forEach(file => {
        addExtraLib(file.path, file.text);
    });
}

window.addEventListener("message", async (e) => {
    if (e.data.type === "FLINT_SEND_TEXT_FILE") {
        editor.setValue(e.data.text);

        const model = editor.getModel();
        monaco.editor.setModelLanguage(model, e.data.language);
    }
    else if (e.data.type === "FLINT_ADD_EXTRA_LIBS") {
        addExtraLibs(e.data.files);
    }
});


window.opener?.postMessage({type: "FLINT_READ_TEXT_FILE"}, "*");

function save() {
    window.opener?.postMessage({type: "FLINT_WRITE_TEXT_FILE", text: editor.getValue()}, "*");
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
        this.tab?.postMessage({
            type: "FLINT_ADD_EXTRA_LIBS",
            files: files
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