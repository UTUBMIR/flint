import Planck from "@flint/public/planck";
import type * as P from "@flint/public/planck";

import { World } from '@flint/runtime/world';
import { System } from '@flint/runtime/system';

type PhysicsBodySync = {
    __physicsSyncFromBody(): void;
};

export class PhysicsWorld extends World {
    private _physicsWorld: P.World;
    private readonly syncBodies = new Set<PhysicsBodySync>();

    public get physicsWorld() {
        return this._physicsWorld;
    }

    public constructor(gravity = { x: 0, y: 9.8 }, pixelsPerMeter = 100) {
        super(pixelsPerMeter);
        this._physicsWorld = new Planck.World(gravity);
    }

    public registerPhysicsBody(body: PhysicsBodySync): void {
        this.syncBodies.add(body);
    }

    public unregisterPhysicsBody(body: PhysicsBodySync): void {
        this.syncBodies.delete(body);
    }

    public override updateStep() {
        if (!this._physicsWorld) return;
        this._physicsWorld.step(System.deltaTime);

        for (const body of this.syncBodies) {
            body.__physicsSyncFromBody();
        }
    }
}
