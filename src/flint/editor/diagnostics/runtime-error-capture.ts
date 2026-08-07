import { System, RunningState } from "@flint/runtime/system";
import { ProblemsStore } from "./problems-store";

export class RuntimeErrorCapture {
    private static installed = false;

    public static install(): void {
        if (RuntimeErrorCapture.installed) {
            return;
        }
        RuntimeErrorCapture.installed = true;

        window.addEventListener("error", RuntimeErrorCapture.onError);
        window.addEventListener("unhandledrejection", RuntimeErrorCapture.onUnhandledRejection);
        window.addEventListener("flint:asset-load-failure", RuntimeErrorCapture.onAssetLoadFailure as EventListener);
    }

    private static isGameRunning(): boolean {
        const state = System.runningState;
        return state === RunningState.Running || state === RunningState.RunningPaused;
    }

    private static isGameStack(stack: string | undefined): boolean {
        if (!stack) {
            return false;
        }

        return /(game-object|layer|world|system|runtime|component|assets|timers|transform|physics|renderer-component)\.ts|blob:|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/.test(stack);
    }

    private static onAssetLoadFailure(event: CustomEvent<{ id: string; url: string; error: unknown }>): void {
        const { id, url, error } = event.detail;
        const message = error instanceof Error ? error.message : String(error ?? "Unknown error");
        const stack = error instanceof Error ? error.stack : undefined;

        ProblemsStore.addRuntimeError(`Failed to load asset "${url}" (${id}): ${message}`, stack);
    }

    private static onError(event: ErrorEvent): void {
        const error = event.error;
        const stack = error instanceof Error ? error.stack : undefined;

        if (!RuntimeErrorCapture.isGameRunning() && !RuntimeErrorCapture.isGameStack(stack)) {
            return;
        }

        if (error instanceof Error) {
            ProblemsStore.addRuntimeError(error.message, error.stack);
        }
        else if (event.message) {
            ProblemsStore.addRuntimeError(event.message);
        }
    }

    private static onUnhandledRejection(event: PromiseRejectionEvent): void {
        const reason = event.reason;
        const stack = reason instanceof Error ? reason.stack : undefined;

        if (!RuntimeErrorCapture.isGameRunning() && !RuntimeErrorCapture.isGameStack(stack)) {
            return;
        }

        if (reason instanceof Error) {
            ProblemsStore.addRuntimeError(reason.message, reason.stack);
        }
        else {
            ProblemsStore.addRuntimeError(String(reason ?? "Unhandled promise rejection"));
        }
    }
}