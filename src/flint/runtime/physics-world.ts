import Planck from "@flint/public/planck";
import type * as P from "@flint/public/planck";

import { World } from '@flint/runtime/world';
import { System } from '@flint/runtime/system';

export class PhysicsWorld extends World {
    private _physicsWorld: P.World;
    private readonly _pixelsPerMeter: number;

    public get physicsWorld() {
        return this._physicsWorld;
    }

    public get pixelsPerMeter() {
        return this._pixelsPerMeter;
    }

    public constructor(gravity = { x: 0, y: 9.8 }, pixelsPerMeter = 100) {
        super();
        this._pixelsPerMeter = pixelsPerMeter > 0 ? pixelsPerMeter : 100;
        this._physicsWorld = new Planck.World(gravity);
    }

    public toPhysicsUnits(value: number): number {
        return value / this._pixelsPerMeter;
    }

    public toPixels(value: number): number {
        return value * this._pixelsPerMeter;
    }

    public override updateStep() {
        if (!this._physicsWorld) return;
        this._physicsWorld.step(System.deltaTime);
    }
}
