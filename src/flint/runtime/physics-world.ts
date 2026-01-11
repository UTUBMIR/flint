// import Planck from "../public/libs/planck";

// import { World } from './world';
// import { System } from './system';
// import Vector2 from "../shared/vector2";

// export class PhysicsWorld extends World {
//     private _world!: typeof Planck.World;

//     public get world() {
//         return this._world;
//     }

//     public constructor(gravity = { x: 0, y: -9.8 }) {
//         super();
//         this.init(gravity);
//     }

//     private async init(gravity: { x: number; y: number }) {
//         this._world = new Planck.World(gravity);
//     }

//     public override updateStep() {
//         if (!this._world) return;
//         this._world.step(System.deltaTime);
//     }

//     public override renderStep() {
//         if (this.layers.length === 0) return;
//         const r = this.layers[0]!.renderer;
//         r.fillColor = "#fff";

//         for (let b = this._world.getBodyList(); b; b = b.getNext()) {
//             const shape = b.m_fixtureList.m_shape;
//             if (shape.m_vertices) {
//                 const verts = shape.m_vertices.map((v: Vector2) => ({
//                     x: v.x * 20,
//                     y: v.y * -20
//                 }));

//                 r.resetTransform();

//                 // Translate to body position in pixels
//                 r.translate(new Vector2(
//                     r.canvas.width / 2 + b.c_position.c.x * 20,
//                     r.canvas.height / 2 - b.c_position.c.y * 20
//                 ));

//                 // Rotate by body angle
//                 r.rotate(-b.c_position.a);

//                 // Draw polygon relative to body origin
//                 r.fillPolygon(verts);
//             }
//         }
//     }
// }