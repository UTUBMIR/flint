import Planck from "@flint/public/planck";
import type * as P from "@flint/public/planck";

import { World } from '@flint/runtime/world';
import { System } from '@flint/runtime/system';

export class PhysicsWorld extends World {
    private _physicsWorld: P.World;

    public get physicsWorld() {
        return this._physicsWorld;
    }

    public constructor(gravity = { x: 0, y: 98 }) {
        super();
        this._physicsWorld = new Planck.World(gravity);
    }

    public override updateStep() {
        if (!this._physicsWorld) return;
        this._physicsWorld.step(System.deltaTime);
    }
}