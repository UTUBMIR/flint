import { FieldRenderer } from "../../editor/component-builder";
import type { ColorString } from "../../shared/graphics";
import Vector2 from "../../shared/vector2";
import RendererComponent from "../renderer-component";

export default class Camera extends RendererComponent {
    public enabled: boolean = true;

    /**
     * Converts a screen-space position (in world/physics units, relative to the screen center)
     * into a world-space position (in world/physics units) using the given camera transform.
     */
    public static screenPhysicsToWorld(screenPosition: Vector2, camera: Camera): Vector2 {
        return Camera.screenPhysicsToWorldAt(screenPosition, camera.position, camera.angle);
    }

    public screenPhysicsToWorld(screenPosition: Vector2) {
        return Camera.screenPhysicsToWorld(screenPosition, this);
    }

    public static screenPhysicsToWorldAt(screenPosition: Vector2, cameraPosition: Vector2, cameraAngle: number): Vector2 {
        const cos = Math.cos(cameraAngle);
        const sin = Math.sin(cameraAngle);

        const rotated = new Vector2(
            screenPosition.x * cos - screenPosition.y * sin,
            screenPosition.x * sin + screenPosition.y * cos
        );

        return cameraPosition.copy().add(rotated);
    }

    public constructor(backgroundColor?: ColorString) {
        super();
        this.backgroundColor = backgroundColor ?? "#222" as ColorString;
    }

    @FieldRenderer("color")
    public backgroundColor: ColorString;

    public get position(): Vector2 {
        return this.transform.position;
    }

    public get angle(): number {
        return this.transform.rotation;
    }

    //TODO: implement camera stuff
    public override attach(): void {
        this.gameObject.layer.cameras.push(this);
    }

    public override detach(): void {
        const cameras = this.gameObject.layer.cameras;
        cameras.splice(cameras.indexOf(this), 1);
    }
}
