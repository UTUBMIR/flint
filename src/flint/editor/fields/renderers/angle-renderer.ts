/* eslint-disable @typescript-eslint/no-explicit-any */
import type { GetType, SetType } from "../field-renderer";
import { NumberRenderer } from "./number-renderer";

export class AngleRenderer extends NumberRenderer {
    constructor() {
        super();
        (this.canRender as any) = (type: string) => {
            return type === "angle";
        };
    }

    render(root: any, path: string[], get: GetType, set: SetType) {
        const newGet = (obj: any, path: string[]): number => {
            return (360 + (get(obj, path) * (180 / Math.PI))) % 360;
        };

        const newSet = (obj: any, path: string[], value: number) => {
            return set(obj, path, (value % 360) * (Math.PI / 180));
        };

        return super.render(root, path, newGet, newSet);
    }
}