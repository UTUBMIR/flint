export type TimerCallback = () => void;

export class Timer {
    private elapsed = 0;

    public constructor(
        public readonly duration: number,
        private readonly callback: TimerCallback,
        private readonly repeat: boolean = false,
        private active = false
    ) { }

    public update(dt: number) {
        if (!this.active) return;

        this.elapsed += dt;

        if (this.elapsed >= this.duration) {
            this.callback();

            if (this.repeat) {
                this.elapsed -= this.duration;
            } else {
                this.active = false;
            }
        }
    }

    public stop() {
        this.active = false;
    }

    public resume() {
        this.active = true;
    }

    public reset() {
        this.elapsed = 0;
        this.active = true;
    }

    public get isActive() {
        return this.active;
    }
}

export class TimerSystem {
    private static timers = new Set<Timer>();
    private static paused = false;

    private constructor() { }

    public static update(dt: number) {
        if (this.paused) return;

        for (const timer of this.timers) {
            timer.update(dt);

            if (!timer.isActive) {
                this.timers.delete(timer);
            }
        }
    }

    public static create(
        duration: number,
        callback: () => void,
        repeat = false,
        active = false
    ) {
        const timer = new Timer(duration, callback, repeat, active);
        this.timers.add(timer);
        return timer;
    }

    public static delete(timer: Timer) {
        this.timers.delete(timer);
    }

    public static clear() {
        this.timers.clear();
    }

    public static pause() {
        this.paused = true;
    }

    public static resume() {
        this.paused = false;
    }
}
