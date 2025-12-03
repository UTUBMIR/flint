import { Renderer2D } from "./flint/shared/renderer2d";
import { System } from "./flint/runtime/system";
import Editor from "./flint/editor/editor";
import Layer from "./flint/runtime/layer";

System.init(new Renderer2D());

const layer = new Layer();

//System.pushLayer(Editor.instance);
System.pushLayer(layer);
System.run();

Editor.init();