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
    private draggedPhysicsBody: PhysicsBody | undefined;
    private draggedOriginalBodyType: PhysicsBody["type"] | undefined;

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

    private setDraggedBodyStatic(): void {
        const current = Editor.inspectorWindow.currentObject;
        if (!current) return;

        const physicsBody = current.getComponent(PhysicsBody);
        if (!physicsBody) return;

        this.draggedPhysicsBody = physicsBody;
        this.draggedOriginalBodyType = physicsBody.type;

        if (physicsBody.type === "static") {
            return;
        }

        try {
            physicsBody.setVelocity(0, 0);
            physicsBody.setAngularVelocity(0);
            physicsBody.type = "static";
        } catch {
            // ignore - body may be detached/destroyed while dragging in editor
        }
    }

    private restoreDraggedBodyType(): void {
        const physicsBody = this.draggedPhysicsBody;
        const originalType = this.draggedOriginalBodyType;

        this.draggedPhysicsBody = undefined;
        this.draggedOriginalBodyType = undefined;

        if (!physicsBody || !originalType || originalType === "static") {
            return;
        }

        try {
            physicsBody.type = originalType;
            physicsBody.setVelocity(0, 0);
            physicsBody.setAngularVelocity(0);
        } catch {
            // ignore - body may be detached/destroyed while dragging in editor
        }
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
            this.drag.cameraProvider = () => this.gameObject.layer.cameras[0];
            this.drag.onGrab = this.setDraggedBodyStatic.bind(this);
            this.drag.onGrabbing = this.syncDraggedPositionToSelectedObject.bind(this);
            this.drag.onRelease = this.restoreDraggedBodyType.bind(this);
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

    public override update(): void {
        this.drag?.update();
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
