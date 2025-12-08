export declare class SystemEvent {
    private _type;
    stopNextLayer: boolean;
    stopImmediate: boolean;
    get type(): string;
    constructor(type: string);
    stopPropagationToNextLayer(): void;
    stopImmediatePropagation(): void;
}
type SystemEventListener = ((event: SystemEvent) => void);
export declare class SystemEventEmitter {
    private listeners;
    private reversed;
    private stopImmediate;
    constructor(stopImmediate?: boolean, reversed?: boolean);
    addEventListener(listener: SystemEventListener): void;
    dispatchEvent(event: SystemEvent): boolean;
    removeEventListener(listener: SystemEventListener): void;
}
export {};
