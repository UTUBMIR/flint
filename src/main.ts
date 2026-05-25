import "golden-layout/dist/css/goldenlayout-base.css";
import "golden-layout/dist/css/themes/goldenlayout-dark-theme.css";
import { System } from "@flint/runtime/system";
import Editor from "@flint/editor/editor";
import { ProcessIndicator } from "@flint/editor/editor";
import { UnsavedChangesDialog } from "@flint/editor/unsaved-changes-dialog";
import { BrowserFileSystem } from "@flint/shared/file-system";
import { PhysicsWorld } from "@flint/runtime/physics-world";
import { initializeEditorLayout } from "@flint/editor/layout";

initializeEditorLayout();

System.init({
    fileSystem: new BrowserFileSystem(),
    world: new PhysicsWorld()
});

System.runRenderingOnly();

ProcessIndicator.init();
UnsavedChangesDialog.init();
Editor.init();
