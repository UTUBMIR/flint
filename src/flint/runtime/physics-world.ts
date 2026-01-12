import Planck, * as P from "../public/planck";

import { World } from './world';
import { System } from './system';

export class PhysicsWorld extends World {
    private _world: P.World;

    public get world() {
        return this._world;
    }

    public constructor(gravity = { x: 0, y: -9.8 }) {
        super();
        this._world = new Planck.World(gravity);
    }

    public override updateStep() {
        if (!this._world) return;
        this._world.step(System.deltaTime);
    }
}