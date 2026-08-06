declare module "*.css";

interface Window {
    FLINT_PREVIEW?: boolean;
    FLINT_LIVE_PREVIEW?: { onData(callback: (data: unknown) => void): void };
}
