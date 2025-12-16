import { Renderer2D } from "./flint/shared/renderer2d";
import { System } from "./flint/runtime/system";
import Editor from "./flint/editor/editor";
import { BrowserFileSystem } from "./flint/shared/file-system";

System.init(new Renderer2D(), new BrowserFileSystem());

System.runRenderingOnly();

Editor.init();