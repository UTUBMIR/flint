import { Renderer2D } from "./flint/shared/renderer2d.js";
import { System } from "./flint/runtime/system.js";
import Input from "./flint/shared/input.js";
import InputAxis from "./flint/shared/input-axis.js";
import Editor from "./flint/editor/editor.js";

System.init(new Renderer2D());

Input.inputAxes = [
    new InputAxis("horizontal", [
        {
            value: -1,
            keys: [
                {
                    type: "keyboard",
                    code: ["KeyA", "ArrowLeft"]
                }]
        },
        {
            value: 1,
            keys: [
                {
                    type: "keyboard",
                    code: ["KeyD", "ArrowRight"]
                }]
        },
    ])
];

// const layer = new Layer();
// layer.addObject(new GameObject([
//     new Shape(),
// ], new Transform(Input.mousePosition)));
Editor.init();


System.pushLayer(Editor.instance);
System.run();