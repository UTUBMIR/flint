import type { GetType, SetType } from "../field-renderer";
import { NumberRenderer } from "./number-renderer";
export declare class AngleRenderer extends NumberRenderer {
    constructor();
    render(root: any, path: string[], get: GetType, set: SetType): any;
}
