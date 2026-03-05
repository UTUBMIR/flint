import Camera from "../runtime/components/camera";
import Shape from "../runtime/components/shape";
import GameObject from "../runtime/game-object";
import Layer from "../runtime/layer";
import type { SystemEvent } from "../runtime/system-event";
import Transform from "../runtime/transform";
import type { IRenderer } from "../shared/irenderer";
import { Rect } from "../shared/primitives";
import Vector2 from "../shared/vector2";
import Editor from "./editor";
import { Drag } from "./interaction";
import { System } from "../runtime/system";
import type { PhysicsWorld } from "@flint/runtime/physics-world";
import PhysicsBody from "../runtime/components/physics/physics-body";

class DragComponent extends Shape {
    private drag: Drag | undefined;

    private getWorldConverters() {
        const world = System.world as Partial<PhysicsWorld>;
        const toPixels = typeof world.toPixels === "function"
            ? world.toPixels.bind(world)
            : (value: number) => value;
        const toMeters = typeof world.toPhysicsUnits === "function"
            ? world.toPhysicsUnits.bind(world)
            : (value: number) => value;

        return { toPixels, toMeters };
    }

    private syncDraggedPositionToSelectedObject(): void {
        const current = Editor.inspectorWindow.currentObject;
        if (!current || !this.drag) return;

        const { toMeters } = this.getWorldConverters();
        const newPosMeters = new Vector2(
            toMeters(this.drag.position.x),
            toMeters(this.drag.position.y)
        );

        const physicsBody = current.getComponent(PhysicsBody);
        if (physicsBody) {
            physicsBody.moveTo(newPosMeters.x, newPosMeters.y);
        } else {
            current.transform.position.assign(newPosMeters);
        }

        this.transform.position.assign(newPosMeters);
    }

    private ensureDrag(targetPositionMeters: Vector2): void {
        const { toPixels } = this.getWorldConverters();

        if (!this.drag) {
            const posPx = targetPositionMeters.copy().set(
                toPixels(targetPositionMeters.x),
                toPixels(targetPositionMeters.y)
            );
            const sizePx = this.transform.size.copy().set(
                toPixels(this.transform.size.x),
                toPixels(this.transform.size.y)
            );

            this.drag = new Drag(new Rect(posPx, sizePx));
            this.drag.onGrabbing = this.syncDraggedPositionToSelectedObject.bind(this);
            return;
        }

        if (this.drag.isDragged()) {
            return;
        }

        const targetPosPx = targetPositionMeters.copy().set(
            toPixels(targetPositionMeters.x),
            toPixels(targetPositionMeters.y)
        );
        this.drag.position.assign(targetPosPx);

        const targetSizePx = this.transform.size.copy().set(
            toPixels(this.transform.size.x),
            toPixels(this.transform.size.y)
        );
        this.drag.size.assign(targetSizePx);
    }

    public override attach(): void {
        super.attach();
        this.ensureDrag(this.transform.position);
    }

    public event(event: SystemEvent): void {
        this.drag?.onEvent(event);
    }

    public override render(renderer: IRenderer): void {
        if (Editor.inspectorWindow.currentObject) {
            const current = Editor.inspectorWindow.currentObject;
            const newPosition = current.transform.position; // meters

            const targetCamera = current.layer.cameras[0]!.transform;
            this.gameObject.layer.cameras[0]!.transform.position = targetCamera.position;
            this.gameObject.layer.cameras[0]!.transform.size = targetCamera.size;

            // Keep the handle object at the selected object's position (meters).
            this.transform.position = newPosition;

            this.ensureDrag(newPosition);

            const drag = this.drag;
            if (!drag) {
                super.render(renderer);
                return;
            }

            if (drag.isHovered) {
                this.fillColor = "rgba(0, 118, 255, 0.5)";
                this.lineColor = "rgba(0, 118, 255, 0.75)";
            }
            else {
                this.fillColor = "rgba(0, 98, 255, 0.5)";
                this.lineColor = "rgba(0, 98, 255, 0.75)";
            }

            super.render(renderer);
        }
        else {
            this.drag = undefined;
        }
    }
}

export class EditorLayer extends Layer {
    public override attach(): void {
        const positionDrag = new DragComponent("rgba(0, 98, 255, 0.5)", "rgba(0, 98, 255, 0.75)", "rgba(0, 0, 0, 0)");

        this.eventEmitter.addEventListener(positionDrag.event.bind(positionDrag));

        this.addObjects([
            new GameObject([
                positionDrag
            ], new Transform(new Vector2(), new Vector2(0.35, 0.35))),
            new GameObject([new Camera("rgba(0, 0, 0, 0)")])
        ]);
    }
}
