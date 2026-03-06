import type { SystemEvent } from "../runtime/system-event";
import Input from "../shared/input";
import type { IRenderer } from "../shared/irenderer";
import { Rect } from "../shared/primitives";
import Vector2 from "../shared/vector2";
import Editor from "./editor";
import visualsConfig from "./config/visuals.json" with { type: 'json' };
import type { ColorString } from "../shared/graphics";
import { System } from "../runtime/system";
import Camera from "../runtime/components/camera";

function getToPixelsConverter(): (value: number) => number {
    const world = System.world as Partial<{ toPixels: (value: number) => number }>;
    return typeof world.toPixels === "function"
        ? world.toPixels.bind(world)
        : (value: number) => value;
}


export class Drag {
    public rect: Rect;
    public dragOffset: Vector2 = new Vector2();

    public hoveredCursor: string = "grab";
    public draggedCursor: string = "grabbing";

    public cameraProvider?: () => Camera | undefined;

    private dragCameraSnapshot: { position: Vector2; angle: number } | undefined;

    public get position(): Vector2 {
        return this.rect.position;
    }
    public set position(value: Vector2) {
        this.rect.position = value;
    }

    public get size(): Vector2 {
        return this.rect.size;
    }
    public set size(value: Vector2) {
        this.rect.size = value;
    }

    public isDragged(): boolean {
        return Editor.draggedItem === this;
    }

    private hovered = false;

    public get isHovered(): boolean {
        return this.hovered;
    }

    public constructor(rect?: Rect) {
        this.rect = rect ?? new Rect();
    }

    private pointerWorldPixels(): Vector2 {
        const toPixels = getToPixelsConverter();
        const snapshot = this.dragCameraSnapshot;
        if (snapshot) {
            const worldPosition = Camera.screenPhysicsToWorldAt(Input.mousePosition, snapshot.position, snapshot.angle);
            return worldPosition.copy().set(toPixels(worldPosition.x), toPixels(worldPosition.y));
        }

        const camera = this.cameraProvider?.();
        if (!camera) {
            return Input.mousePositionPixels.copy();
        }

        const worldPosition = Camera.screenPhysicsToWorld(Input.mousePosition, camera);
        return worldPosition.copy().set(toPixels(worldPosition.x), toPixels(worldPosition.y));
    }

    public render(r: IRenderer) {
        r.fillColor = "#f88";
        r.fillRect(this.position, this.size);
    }

    public onEvent(event: SystemEvent): void {
        const isDown = event.type === "pointerdown";
        const isMove = event.type === "pointermove";
        const isUp = event.type === "pointerup";
        this.hovered = false;

        const mouseWorldPixels = this.pointerWorldPixels();
        const fixedMouse = mouseWorldPixels.copy().add(new Vector2(this.size.x / 2, this.size.y / 2));

        if (isDown && Input.isMouseButtonPressed(0) && this.rect.contains(fixedMouse)) {
            const camera = this.cameraProvider?.();
            if (camera) {
                this.dragCameraSnapshot = { position: camera.position.copy(), angle: camera.angle };
            }

            this.dragOffset.assign(this.position.copy().subtract(mouseWorldPixels));

            Editor.draggedItem = this;
            this.hovered = true;
            System.setCursor(this.draggedCursor);
            this.onGrab();

            event.stopImmediatePropagation();
            return;
        }

        if (isMove && !this.isDragged() && this.rect.contains(fixedMouse)) {
            System.setCursor(this.hoveredCursor);
            this.hovered = true;

            event.stopImmediatePropagation();
            return;
        }

        if (isMove && this.isDragged()) {
            this.position.assign(mouseWorldPixels.copy().add(this.dragOffset));

            // this.rect.clamp(
            //     new Rect(
            //         new Vector2(0, 0),
            //         new Vector2(window.innerWidth, window.innerHeight)
            //     )
            // );
            System.setCursor(this.draggedCursor);
            this.hovered = true;
            this.onGrabbing();

            event.stopImmediatePropagation();
            return;
        }

        if (isUp && this.isDragged()) {
            Editor.draggedItem = undefined;
            this.dragCameraSnapshot = undefined;
            this.onRelease();
            System.setCursor(this.hoveredCursor);
            this.hovered = true;

            event.stopImmediatePropagation();
            return;
        }
    }

    public onGrab() { }
    public onGrabbing() { }
    public onRelease() { }
}

export class Click {
    public rect: Rect;

    public hoveredCursor: string = "pointer";
    public holdCursor: string = "pointer";

    public pressed: boolean = false;
    public hovered: boolean = false;

    public cameraProvider?: () => Camera | undefined;

    public get position(): Vector2 {
        return this.rect.position;
    }
    public set position(value: Vector2) {
        this.rect.position = value;
    }

    public get size(): Vector2 {
        return this.rect.size;
    }
    public set size(value: Vector2) {
        this.rect.size = value;
    }


    public constructor(rect?: Rect) {
        this.rect = rect ?? new Rect();
    }

    private pointerWorldPixels(): Vector2 {
        const camera = this.cameraProvider?.();
        if (!camera) {
            return Input.mousePositionPixels.copy();
        }

        const worldPosition = Camera.screenPhysicsToWorld(Input.mousePosition, camera);
        const toPixels = getToPixelsConverter();
        return worldPosition.copy().set(toPixels(worldPosition.x), toPixels(worldPosition.y));
    }

    public render(r: IRenderer) {
        r.fillColor = "#8f8";
        r.fillRect(this.position, this.size);
    }

    public onEvent(event: SystemEvent): void {
        const isDown = event.type === "pointerdown";
        const isMove = event.type === "pointermove";
        const isUp = event.type === "pointerup";

        const mouseWorldPixels = this.pointerWorldPixels();

        if (isDown && Input.isMouseButtonPressed(0) && this.rect.contains(mouseWorldPixels)) {
            this.pressed = true;

            System.setCursor(this.holdCursor);
            this.onMouseDown();
            event.stopImmediatePropagation();
            return;
        }

        if (isMove) {
            const mouseHovered = this.rect.contains(mouseWorldPixels);
            if (mouseHovered != this.hovered) {
                if (mouseHovered) {
                    this.onHover();
                }
                else {
                    this.onHoverLeave();
                }
            }
            this.hovered = mouseHovered;

            if (mouseHovered) {
                System.setCursor(this.hoveredCursor);
                event.stopImmediatePropagation();
                return;
            }
        }

        if (isUp && this.pressed && this.rect.contains(mouseWorldPixels)) {
            this.pressed = false;

            this.onMouseUp();
            System.setCursor(this.hoveredCursor);
            event.stopImmediatePropagation();
            return;
        }
    }

    public onMouseDown() { }
    public onMouseUp() { }
    public onHover() { }
    public onHoverLeave() { }
}

export class Button extends Click {
    public text: string;
    public color: ColorString = visualsConfig.colors.toolbarTab as ColorString;

    public constructor(rect: Rect, text?: string) {
        super(rect);
        this.text = text ?? "";
    }

    public override onHoverLeave() {
        this.color = visualsConfig.colors.toolbarTab as ColorString;
    };

    public override onHover() {
        this.color = visualsConfig.colors.toolbarTabSelected as ColorString;
    };

    public override onMouseUp = this.onHover;

    public override onMouseDown() {
        this.color = visualsConfig.colors.toolbarTabPressed as ColorString;
        this.onClick();
    };

    public override render(r: IRenderer) {
        r.fillColor = this.color;
        r.fillRect(this.position, this.size);

        if (this.text === "") return;

        r.fillColor = visualsConfig.colors.textColor as ColorString;
        r.textBaseLine = "middle";
        r.textAlign = "center";
        r.fontSize = 16;

        r.fillText(this.position.add(this.size.divide(2)), this.text);
    }

    public onClick() { }
}

export class Tree {
    public readonly button: Button;
    public items: (Click | Drag | Tree | {rect: Rect, render: (r: IRenderer) => void, onEvent: (e: SystemEvent) => void})[] = [];

    private _contentHeight: number = 0;
    public open: boolean = false;
    public triangleRadius = 5;
    public nestedSpacing = 5;

    private locked = false;

    public get rect() {
        return this.button.rect;
    }

    public set rect(rect: Rect) {
        this.button.rect = rect;
    }

    public get contentHeight(): number {
        return this._contentHeight;
    }

    public constructor(rect: Rect, name?: string) {
        this.button = new Button(rect, name);
        this.button.onClick = () => {
            this.open = !this.open;
        };
    }

    public lockState(open: boolean) {
        this.open = open;
        this.locked = true;
    }

    public render(r: IRenderer) {
        this.onRenderInternal(r);
        this.onRenderContent(r);
    }

    public onRenderInternal(r: IRenderer) {
        this.button.render(r);

        r.fillColor = "#fff";
        const c = this.rect.position.add(new Vector2(this.rect.size.y / 2));

        if (this.open) {
            r.fillPolygon([
                { x: c.x - this.triangleRadius, y: c.y - this.triangleRadius },
                { x: c.x, y: c.y + this.triangleRadius },
                { x: c.x + this.triangleRadius, y: c.y - this.triangleRadius },

            ]);
        }
        else {
            r.fillPolygon([
                { x: c.x - this.triangleRadius, y: c.y - this.triangleRadius },
                { x: c.x - this.triangleRadius, y: c.y + this.triangleRadius },
                { x: c.x + this.triangleRadius, y: c.y },
            ]);
        }
    }

    public onRenderContent(r: IRenderer) {
        this._contentHeight = this.rect.height;
        if (!this.open) return;

        for (const item of this.items) {
            ++this._contentHeight;

            item.rect.position.set(this.rect.x + this.nestedSpacing, this.rect.y + this._contentHeight);
            item.rect.width = this.rect.width - this.nestedSpacing;
            this._contentHeight += ((item as Tree).contentHeight || item.rect.height);

            item.render(r);
        }
    }

    public onEvent(event: SystemEvent) {
        if (!this.locked) {
            this.button.onEvent(event);
        }
        if (!this.open) return;

        for (const item of this.items) {
            item.onEvent(event);
        }
    }
}
