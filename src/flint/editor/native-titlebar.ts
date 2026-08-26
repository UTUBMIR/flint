type WindowControlsOverlayLike = {
    readonly visible: boolean;
    addEventListener(type: "geometrychange", listener: () => void): void;
};

const WCO_ACTIVE_CLASS = "wco-active";

/// Integrates the editor toolbar with the native title bar when the app is
/// installed as a PWA running with the window-controls-overlay display mode.
export class NativeTitlebar {
    public static init(): void {
        const overlay = (navigator as Navigator & { windowControlsOverlay?: WindowControlsOverlayLike }).windowControlsOverlay;
        if (!overlay) {
            return;
        }

        const sync = () => {
            document.documentElement.classList.toggle(WCO_ACTIVE_CLASS, overlay.visible);
        };

        overlay.addEventListener("geometrychange", sync);
        sync();
    }
}
