import { Renderer2D } from "./flint/shared/renderer2d.js";
import { System } from "./flint/runtime/system.js";
import Editor from "./flint/editor/editor.js";
import Layer from "./flint/runtime/layer.js";

System.init(new Renderer2D());

const layer = new Layer();

//System.pushLayer(Editor.instance);
System.pushLayer(layer);
System.run();

Editor.init();