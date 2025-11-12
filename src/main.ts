import Script from "./flint/components/script.js";
import Shape from "./flint/components/shape.js";
import Transform from "./flint/components/transform.js";
import GameObject from "./flint/game-object.js";
import Layer from "./flint/layer.js";
import { Renderer2D } from "./flint/renderer2d.js";
import { System } from "./flint/system.js";
import Vector2D from "./flint/vector2d.js";

System.init(new Renderer2D());

const layer = new Layer();
layer.addObject(new GameObject([
    new Transform(new Vector2D(200, 500)),
    new Shape(),
    new Script(obj => obj.requireComponent(Transform).position.x = performance.now() / 10 % 1000)
]));

System.pushLayer(layer);
System.run();