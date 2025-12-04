import { Renderer2D } from "./flint/shared/renderer2d";
import { System } from "./flint/runtime/system";
import Editor from "./flint/editor/editor";

System.init(new Renderer2D());

System.run();

Editor.init();