#!/usr/bin/env node
import { buildProject } from "./build";
import { initProject } from "./init";
import { createComponent } from "./component";
import { assetCommand } from "./asset";

function usage(): void {
    console.error(
        "Usage: flint <command> [args]\n" +
        "Commands:\n" +
        "  build <projectDir> [--output <file>] [--no-minify]   build a project\n" +
        "  init <dir> [--minimal]                               create a new project\n" +
        "  component <Name> [--dir <projectDir>]                 create a component\n" +
        "  asset <list|add|remove|rename> [args] [--dir <dir>]   manage registered assets\n" +
        "  --help, -h                                           show this help\n" +
        "  --version                                            print version number and exit"
    );
}

async function main(): Promise<void> {
    const args = process.argv.slice(2);

    if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
        usage();
        process.exit(1);
    }

    if (args[0] === "--version") {
        console.log("flint 0.0.1");
        process.exit(0);
    }

    try {
        switch (args[0]) {
            case "build": {
                let projectDir: string | undefined;
                const buildArgs = args.slice(1);

                for (let i = 0; i < buildArgs.length; i++) {
                    if (!buildArgs[i]!.startsWith("-")) {
                        projectDir = buildArgs[i];
                        break;
                    }
                }

                if (!projectDir) {
                    usage();
                    process.exit(1);
                }

                await buildProject(projectDir, { ...parseBuildOptions(buildArgs) });
                break;
            }

            case "init": {
                const dir = args[1];
                if (!dir) {
                    console.error("Usage: flint init <dir> [--minimal]");
                    process.exit(1);
                }

                await initProject(dir, { minimal: args.includes("--minimal") });
                break;
            }

            case "component": {
                const name = args[1];
                if (!name) {
                    console.error("Usage: flint component <Name> [--dir <projectDir>]");
                    process.exit(1);
                }

                const dir = flagValue(args, "--dir") ?? ".";
                await createComponent(dir, name);
                break;
            }

            case "asset":
                await assetCommand(args.slice(1), ".");
                break;

            default:
                console.error(`Unknown command: ${args[0]}`);
                usage();
                process.exit(1);
        }
    } catch (error) {
        console.error("Failed:", error instanceof Error ? error.message : error);
        process.exit(1);
    }
}

function parseBuildOptions(args: string[]): { output?: string; minify?: boolean } {
    const options: { output?: string; minify?: boolean } = {};

    for (let i = 0; i < args.length; i++) {
        const arg = args[i]!;

        if (arg === "--output") {
            options.output = args[++i];
        } else if (arg === "--no-minify") {
            options.minify = false;
        }
    }

    return options;
}

function flagValue(args: string[], flag: string): string | undefined {
    const index = args.indexOf(flag);
    return index !== -1 ? args[index + 1] : undefined;
}

main();
