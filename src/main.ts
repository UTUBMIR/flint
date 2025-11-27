import { Renderer2D } from "./flint/shared/renderer2d.js";
import { System } from "./flint/runtime/system.js";
import Editor from "./flint/editor/editor.js";
import Layer from "./flint/runtime/layer.js";
import GameObject from "./flint/runtime/game-object.js";
import Shape from "./flint/runtime/components/shape.js";
import Camera from "./flint/runtime/components/camera.js";
import Transform from "./flint/runtime/transform.js";
import Vector2D from "./flint/shared/vector2d.js";

System.init(new Renderer2D());


const layer = new Layer();
layer.addObject(new GameObject([
    new Shape(),
], new Transform(new Vector2D(), new Vector2D(100, 100))));

layer.addObject(new GameObject([
    new Shape(),
], new Transform(new Vector2D(150, 0), new Vector2D(100, 100))));

layer.addObject(new GameObject([
    new Shape(),
], new Transform(new Vector2D(300, 0), new Vector2D(100, 100))));


layer.addObject(new GameObject([
    new Camera()
]));


//System.pushLayer(Editor.instance);
System.pushLayer(layer);
System.run();

Editor.init();