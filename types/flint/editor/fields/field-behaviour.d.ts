export interface FieldBehavior {
    attach(element: HTMLElement, context: BehaviorContext): void;
}
export interface BehaviorContext {
    get(): any;
    set(v: any): void;
    update(): void;
}
