import Planck from "../public/planck";
import type * as P from "../public/planck";

import { World } from './world';
import { System } from './system';

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