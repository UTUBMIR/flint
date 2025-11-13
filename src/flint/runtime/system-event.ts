export class SystemEvent {
    private _type: string;
    public stopNextLayer: boolean = false;
    public stopImmediate: boolean = false;

    public get type(): string {
        return this._type;
    }

    public constructor(type: string) {
        this._type = type;
    }

    stopPropagationToNextLayer() {
        this.stopNextLayer = true;
    }

    stopImmediatePropagation() {
        this.stopImmediate = true;
    }
}

type SystemEventListener = ((event: SystemEvent) => void);

export class SystemEventEmitter {
    private listeners: SystemEventListener[] = [];
    private reversed: boolean;
    private stopImmediate: boolean;

    constructor(stopImmediate: boolean = false, reversed: boolean = false) {
        this.reversed = reversed;
        this.stopImmediate = stopImmediate;
    }

    public addEventListener(listener: SystemEventListener): void {
        if (this.reversed) {
            this.listeners.unshift(listener);
        }
        else {
            this.listeners.push(listener);
        }
    }

    public dispatchEvent(event: string): void {
        const systemEvent = new SystemEvent(event);
        for (let i = 0; i < this.listeners.length; ++i) {
            const listener = this.listeners[i];
            if (!listener) return;

            listener(systemEvent);
            if (this.stopImmediate) {
                if (systemEvent.stopImmediate) {
                    systemEvent.stopPropagationToNextLayer();
                    break;
                }
                else if (systemEvent.stopNextLayer) {
                    break;
                }
            }
        }
    }

    public removeEventListener(listener: SystemEventListener): void {
        const index = this.listeners.indexOf(listener);
        if (index != -1) {
            this.listeners.splice(index, 1);
        }
    }
}