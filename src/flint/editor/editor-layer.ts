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

class DragComponent extends Shape {
    private drag: Drag | undefined;

    public override attach(): void {
        super.attach();
        this.drag = new Drag(new Rect(this.transform.position, this.transform.size));
    }

    public event(event: SystemEvent): void {
        this.drag?.onEvent(event);
    }

    public override render(renderer: IRenderer): void {
        if (Editor.inspectorWindow.currentObject) {
            const newPosition = Editor.inspectorWindow.currentObject.transform.position;

            if (!this.drag || this.drag.position !== newPosition) {
                const targetCamera = Editor.inspectorWindow.currentObject.layer.cameras[0]!.transform;
                this.gameObject.layer.cameras[0]!.transform.position = targetCamera.position;
                this.gameObject.layer.cameras[0]!.transform.size = targetCamera.size;

                this.transform.position = newPosition;
                this.drag = new Drag(new Rect(newPosition, this.transform.size));
            }

            if (this.drag.isHovered) {
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
            ], new Transform(new Vector2(), new Vector2(35, 35))),
            new GameObject([new Camera("rgba(0, 0, 0, 0)")])
        ]);
    }
}