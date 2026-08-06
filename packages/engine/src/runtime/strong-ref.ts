/* eslint-disable @typescript-eslint/no-explicit-any */

export default class StrongRef<T> {
    public constructor(private parent: any, private key: any) {}

    public get value() {
        return this.parent[this.key];
    }

    public set value(value: T) {
        this.parent[this.key] = value;
    }
}