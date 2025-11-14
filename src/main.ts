import { Renderer2D } from "./flint/shared/renderer2d.js";
import { System } from "./flint/runtime/system.js";
import Input from "./flint/shared/input.js";
import InputAxis from "./flint/shared/input-axis.js";
import Editor from "./flint/editor/editor.js";
import Layer from "./flint/runtime/layer.js";
import GameObject from "./flint/runtime/game-object.js";
import Shape from "./flint/runtime/components/shape.js";

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
    ]),
    new InputAxis("vertical", [
        {
            value: -1,
            keys: [
                {
                    type: "keyboard",
                    code: ["KeyW", "ArrowUp"]
                }]
        },
        {
            value: 1,
            keys: [
                {
                    type: "keyboard",
                    code: ["KeyS", "ArrowDown"]
                }]
        },
    ])
];

const layer = new Layer();
layer.addObject(new GameObject([
    new Shape(),
]));
Editor.init();

System.pushLayer(Editor.instance);
System.pushLayer(layer);
Editor.viewportWindow.layer = layer;
System.run();