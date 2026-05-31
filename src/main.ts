import "golden-layout/dist/css/goldenlayout-base.css";
import "golden-layout/dist/css/themes/goldenlayout-dark-theme.css";
import { System } from "@flint/runtime/system";
import Editor from "@flint/editor/editor";
import { ProcessIndicator } from "@flint/editor/editor";
import { UnsavedChangesDialog } from "@flint/editor/unsaved-changes-dialog";
import { BrowserFileSystem } from "@flint/shared/file-system";
import { PhysicsWorld } from "@flint/runtime/physics-world";
import { initializeEditorLayout, initializePopoutWindow } from "@flint/editor/layout";
import type { PopoutComponentConfig } from "@flint/editor/cross-window";

const popoutParam = new URLSearchParams(window.location.search).get("gl_popout");
// NOTE: This is popout window code
if (popoutParam) {
    document.body.classList.add("flint-popout-mode");
    const config: PopoutComponentConfig = JSON.parse(decodeURIComponent(popoutParam));

    System.init({
        fileSystem: new BrowserFileSystem(),
        world: new PhysicsWorld()
    });

    initializePopoutWindow(config);
}
else { // NOTE: This is the actual entry-point for the editor
    initializeEditorLayout();

    System.init({
        fileSystem: new BrowserFileSystem(),
        world: new PhysicsWorld()
    });

    System.runRenderingOnly();

    ProcessIndicator.init();
    UnsavedChangesDialog.init();
    Editor.init();
}
