import Shape from "./flint/runtime/components/shape.js";
import GameObject from "./flint/runtime/game-object.js";
import Layer from "./flint/runtime/layer.js";
import { Renderer2D } from "./flint/shared/renderer2d.js";
import { System } from "./flint/runtime/system.js";
import Transform from "./flint/runtime/transform.js";
import Vector2D from "./flint/shared/vector2d.js";
System.init(new Renderer2D());

const layer = new Layer();
layer.addObject(new GameObject([
    new Shape(),
], new Transform(new Vector2D(100, 100))));

System.pushLayer(layer);
System.run();