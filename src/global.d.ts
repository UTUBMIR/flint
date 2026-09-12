declare module "*.css";
declare module "@xterm/xterm/css/xterm.css";

interface Window {
    FLINT_PREVIEW?: boolean;
    FLINT_LIVE_PREVIEW?: { onData(callback: (data: unknown) => void): void };
}
