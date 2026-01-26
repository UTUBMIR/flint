// export const componentPaths = {
//     "Camera": "camera",
//     "Shape": "shape"
// } as const;

export { default as Camera } from "./camera";
export { default as Shape } from "./shape";
export { default as Transform } from "../transform";
export { default as Label } from "./label";
export { BoxCollider } from "./physics/box-collider";
export { default as Collider } from "./physics/collider";
export { default as RigidBody } from "./physics/physics-body";