import type { RawProjectData, BuildConfig } from "./project-data";

export type ProjectTemplateFile = { path: string; content: string };
export type ProjectTemplateComponent = { name: string; file: string };

export const defaultTsConfig = `{
    "compilerOptions": {
        "baseUrl": ".",
        "paths": {
            "@flint/*": [
                "flint/*"
            ]
        },
        "noImplicitOverride": true,
        "module": "esnext",
        "target": "esnext",
        "experimentalDecorators": false,
        "useDefineForClassFields": false
    }
}`;

export function defaultProjectConfig(options: { minimal?: boolean } = {}): BuildConfig & { assets: never[]; rootPath: string } {
    return {
        components: options.minimal ? [] : defaultProjectComponents(),
        assets: [],
        usePhysics: true,
        physicsPixelsPerMeter: 100,
        physicsGravityX: 0,
        physicsGravityY: 9.8,
        generateJsMap: false,
        incrementalRebuilds: true,
        rootPath: "virtual"
    };
}

export function defaultProjectComponents(): ProjectTemplateComponent[] {
    return [
        { name: "HelloWorld", file: "/assets/hello-world.ts" },
        { name: "Rotate", file: "/assets/rotate.ts" }
    ];
}

export function defaultProjectFiles(): ProjectTemplateFile[] {
    return [
        {
            path: "assets/hello-world.ts",
            content: `import Label from "@flint/runtime/components/label";

// Components are (often) small scripts you attach to GameObjects.
// This one extends Label, so it already knows how to draw text on screen.
export class HelloWorld extends Label {
    // Label already has these fields, so we override their default values here.
    override text = "Hello world!";
    override fontSize = 32;

    start() {
        // start() runs once when the game begins.
        console.log("Hello world!");
    }
}
`
        },
        {
            path: "assets/rotate.ts",
            content: `import Component from "@flint/runtime/component";
import { System } from "@flint/runtime/system";

// This is the simplest kind of Flint component.
// It extends Component directly, then changes its GameObject's Transform.
export class Rotate extends Component {
    rotationSpeed = 2;

    start() {
        // Make the rectangle a little wider when the game starts.
        this.transform.size.x = 2;
    }

    update() {
        // Rotate smoothly. deltaTime keeps the speed stable on high and low fps.
        this.transform.rotation += this.rotationSpeed * System.deltaTime;
    }
}
`
        }
    ];
}

export function defaultProjectData(): RawProjectData {
    return {
        layers: [
            {
                id: crypto.randomUUID(),
                objects: [
                    {
                        id: crypto.randomUUID(),
                        components: [
                            {
                                name: "Transform",
                                data: {
                                    position: { x: 0, y: 0 },
                                    size: { x: 1, y: 1 },
                                    rotation: 0
                                }
                            },
                            { name: "HelloWorld", data: {} },
                            { name: "Rotate", data: {} }
                        ]
                    },
                    {
                        id: crypto.randomUUID(),
                        components: [
                            {
                                name: "Transform",
                                data: {
                                    position: { x: 0, y: 0 },
                                    size: { x: 1, y: 1 },
                                    rotation: 0
                                }
                            },
                            {
                                name: "Camera",
                                data: {
                                    enabled: true,
                                    isMainCamera: true,
                                    zoom: 1,
                                    backgroundColor: "#222"
                                }
                            }
                        ]
                    }
                ]
            }
        ],
        assets: []
    };
}

export function minimalProjectData(): RawProjectData {
    return {
        layers: [],
        assets: []
    };
}
