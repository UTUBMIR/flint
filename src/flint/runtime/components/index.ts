// export const componentPaths = {
//     "Camera": "camera",
//     "Shape": "shape"
// } as const;

export { default as Camera } from "./camera";
export { default as Shape } from "./shape";
export { default as Transform } from "../transform";
export { default as Label } from "./label";
export { default as Image } from "./image";
export { default as Collider } from "./physics/collider";
export { BoxCollider } from "./physics/box-collider";
export { default as PhysicsBody } from "./physics/physics-body";