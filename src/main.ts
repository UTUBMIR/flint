import { Renderer2D } from "./flint/shared/renderer2d.js";
import { System } from "./flint/runtime/system.js";
import Editor from "./flint/editor/editor.js";
import Layer from "./flint/runtime/layer.js";
import GameObject from "./flint/runtime/game-object.js";
import Shape from "./flint/runtime/components/shape.js";
import Camera from "./flint/runtime/components/camera.js";

System.init(new Renderer2D());


const layer = new Layer();
layer.addObject(new GameObject([
    new Shape(),
]));
layer.addObject(new GameObject([
    new Camera()
]));

Editor.init();

System.pushLayer(Editor.instance);
System.pushLayer(layer);
System.pushLayer(new Layer());
Editor.viewportWindow.layer = layer;
System.run();