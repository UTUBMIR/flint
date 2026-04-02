import Camera from "../runtime/components/camera";
import Shape from "../runtime/components/shape";
import GameObject from "../runtime/game-object";
import Layer from "../runtime/layer";
import type { SystemEvent } from "../runtime/system-event";
import Transform from "../runtime/transform";
import type { IRenderer } from "../shared/irenderer";
import { Color, type ColorString } from "../shared/graphics";
import { Rect } from "../shared/primitives";
import Vector2 from "../shared/vector2";
import Editor from "./editor";
import { Drag } from "./interaction";
import { System } from "../runtime/system";
import type { PhysicsWorld } from "@flint/runtime/physics-world";
import PhysicsBody from "../runtime/components/physics/physics-body";

type DragPalette = {
    fill: ColorString;
    line: ColorString;
    hoverFill: ColorString;
    hoverLine: ColorString;
};

type DragMoveContext = {
    current: GameObject;
    previousPositionMeters: Vector2;
    nextPositionMeters: Vector2;
};

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function parseColor(color: ColorString): Color {
    if (color.startsWith("#")) {
        return Color.fromHex(color);
    }

    const channels = color.match(/[\d.]+/g);
    if (!channels || channels.length < 3) {
        return new Color();
    }

    const [r, g, b, a = "1"] = channels;
    return new Color(
        clamp(Number(r) / 255, 0, 1),
        clamp(Number(g) / 255, 0, 1),
        clamp(Number(b) / 255, 0, 1),
        clamp(Number(a), 0, 1)
    );
}

function tintColor(color: Color, amount: number): Color {
    return new Color(
        clamp(color.r + (1 - color.r) * amount, 0, 1),
        clamp(color.g + (1 - color.g) * amount, 0, 1),
        clamp(color.b + (1 - color.b) * amount, 0, 1),
        color.a
    );
}

function withAlpha(color: Color, alpha: number): Color {
    return new Color(color.r, color.g, color.b, clamp(alpha, 0, 1));
}

function createDragPalette(baseColor: ColorString): DragPalette {
    const color = parseColor(baseColor);
    const fill = withAlpha(color, color.a);
    const line = withAlpha(color, clamp(color.a + 0.25, 0, 1));
    const hover = tintColor(color, 0.2);

    return {
        fill: fill.toCSS() as ColorString,
        line: line.toCSS() as ColorString,
        hoverFill: withAlpha(hover, fill.a).toCSS() as ColorString,
        hoverLine: withAlpha(hover, line.a).toCSS() as ColorString
    };
}

class DragComponent extends Shape {
    public static readonly DEFAULT_COLOR = "rgba(0, 98, 255, 0.5)";

    private readonly palette: DragPalette;
    protected readonly handleOffset: Vector2;

    private drag: Drag | undefined;
    private draggedPhysicsBody: PhysicsBody | undefined;
    private draggedOriginalBodyType: PhysicsBody["type"] | undefined;

    public constructor(
        baseColor: ColorString = DragComponent.DEFAULT_COLOR,
        shadowColor: ColorString = "rgba(0, 0, 0, 0)",
        handleOffset: Vector2 = new Vector2()
    ) {
        const palette = createDragPalette(baseColor);
        super(palette.fill, palette.line, shadowColor);
        this.palette = palette;
        this.handleOffset = handleOffset.copy();
    }

    private get selectedObject() {
        return Editor.inspectorWindow.currentObject;
    }

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

    private toPixelVector(value: Vector2): Vector2 {
        const { toPixels } = this.getWorldConverters();
        return value.copy().set(
            toPixels(value.x),
            toPixels(value.y)
        );
    }

    protected getHandlePosition(objectPositionMeters: Vector2): Vector2 {
        return objectPositionMeters.copy().add(this.handleOffset);
    }

    private syncEditorCameraToSelection(): void {
        const current = this.selectedObject;
        if (!current) return;

        const camera = current.layer.cameras[0];
        if (!camera) return;

        const targetCamera = camera.transform;
        const editorCamera = this.gameObject.layer.cameras[0]!.transform; // NOTE: Editor controls the camera
        editorCamera.position = targetCamera.position;
        editorCamera.size = targetCamera.size;
    }

    private applyVisualState(isHovered: boolean): void {
        if (isHovered) {
            this.fillColor = this.palette.hoverFill;
            this.lineColor = this.palette.hoverLine;
            return;
        }

        this.fillColor = this.palette.fill;
        this.lineColor = this.palette.line;
    }

    private setDraggedBodyStatic(): void {
        const current = this.selectedObject;
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

    protected applyDraggedPosition({ current, nextPositionMeters }: DragMoveContext): void {
        current.transform.position.assign(nextPositionMeters);
        this.transform.position.assign(this.getHandlePosition(nextPositionMeters));
    }

    private syncDraggedPositionToSelectedObject(): void {
        const current = this.selectedObject;
        if (!current || !this.drag) return;

        const previousPositionMeters = current.transform.position.copy();
        const { toMeters } = this.getWorldConverters();
        const nextHandlePositionMeters = new Vector2(
            toMeters(this.drag.position.x),
            toMeters(this.drag.position.y)
        );
        const nextPositionMeters = nextHandlePositionMeters.subtract(this.handleOffset);

        this.applyDraggedPosition({
            current,
            previousPositionMeters,
            nextPositionMeters
        });
    }

    private ensureDrag(targetPositionMeters: Vector2): void {
        if (!this.drag) {
            this.drag = new Drag(new Rect(
                this.toPixelVector(targetPositionMeters),
                this.toPixelVector(this.transform.size)
            ));
            this.configureDrag(this.drag);
            return;
        }

        if (this.drag.isDragged()) {
            return;
        }

        this.drag.position.assign(this.toPixelVector(targetPositionMeters));
        this.drag.size.assign(this.toPixelVector(this.transform.size));
    }

    private configureDrag(drag: Drag): void {
        drag.cameraProvider = () => this.gameObject.layer.cameras[0];
        drag.onGrab = this.setDraggedBodyStatic.bind(this);
        drag.onGrabbing = this.syncDraggedPositionToSelectedObject.bind(this);
        drag.onRelease = this.restoreDraggedBodyType.bind(this);
    }

    public override attach(): void {
        super.attach();
        this.ensureDrag(this.transform.position);
    }

    public event(event: SystemEvent): void {
        this.drag?.onEvent(event);
    }

    public override render(renderer: IRenderer): void {
        const current = this.selectedObject;
        if (current) {
            const objectPosition = current.transform.position;
            const handlePosition = this.getHandlePosition(objectPosition);

            this.syncEditorCameraToSelection();

            // Keep the handle object aligned to the selected object plus its local offset.
            this.transform.position = handlePosition;

            this.ensureDrag(handlePosition);
            this.applyVisualState(this.drag?.isHovered ?? false);

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

class HorizontalDragComponent extends DragComponent {
    protected override applyDraggedPosition({ current, nextPositionMeters }: DragMoveContext): void {
        current.transform.position.x = nextPositionMeters.x;
        this.transform.position.x = nextPositionMeters.x;
    }
}

class VerticalDragComponent extends DragComponent {
    protected override applyDraggedPosition({ current, nextPositionMeters }: DragMoveContext): void {
        current.transform.position.y = nextPositionMeters.y;
        this.transform.position.y = nextPositionMeters.y;
    }
}


export class EditorLayer extends Layer {
    public override attach(): void {
        const positionDrag = new DragComponent(
            DragComponent.DEFAULT_COLOR,
            "rgba(0, 0, 0, 0)",
            new Vector2()
        );

        const horizontalDrag = new HorizontalDragComponent( // should be red
            "rgb(255, 0, 0)",
            "rgba(0, 0, 0, 0)",
            new Vector2(0.525, 0)
        );

        const verticalDrag = new VerticalDragComponent( // should be red
            "rgb(0, 255, 0)",
            "rgba(0, 0, 0, 0)",
            new Vector2(0, -0.525)
        );


        this.eventEmitter.addEventListener(positionDrag.event.bind(positionDrag));
        this.eventEmitter.addEventListener(horizontalDrag.event.bind(horizontalDrag));
        this.eventEmitter.addEventListener(verticalDrag.event.bind(verticalDrag));

        this.addObjects([
            new GameObject([
                positionDrag
            ], new Transform(new Vector2(), new Vector2(0.35, 0.35))),

            new GameObject([
                horizontalDrag
            ], new Transform(new Vector2(), new Vector2(0.7, 0.13))),

            new GameObject([
                verticalDrag
            ], new Transform(new Vector2(), new Vector2(0.13, 0.7))),

            new GameObject([new Camera("rgba(0, 0, 0, 0)")])
        ]);
    }
}
