import type { EditorWindowControl } from "./window-framework";

const CONTROL_SELECTOR = "[data-flint-window-control]";

type WindowControlButton = HTMLButtonElement & {
    __flintControl?: EditorWindowControl;
};

export type RenderWindowControlsOptions = {
    placement?: "append" | "prepend";
    extraClassName?: string;
};

function stopHeaderInteraction(event: Event): void {
    event.preventDefault();
    event.stopPropagation();
}

function getOrCreateIcon(button: HTMLElement): HTMLElement {
    const existingIcon = button.querySelector<HTMLElement>("sl-icon");
    if (existingIcon) {
        return existingIcon;
    }

    const icon = document.createElement("sl-icon");
    icon.setAttribute("aria-hidden", "true");
    button.prepend(icon);
    return icon;
}

export function setWindowControlIcon(button: HTMLElement, iconName: string): void {
    const icon = getOrCreateIcon(button);
    icon.setAttribute("name", iconName);
}

function applyControlState(button: WindowControlButton, control: EditorWindowControl): void {
    button.__flintControl = control;
    button.title = control.title;
    button.setAttribute("aria-label", control.ariaLabel);
    button.disabled = control.disabled === true;
    button.classList.toggle("active", control.active === true);
    setWindowControlIcon(button, control.icon);
}

function createControlButton(control: EditorWindowControl, extraClassName: string | undefined): WindowControlButton {
    const button = document.createElement("button") as WindowControlButton;
    button.type = "button";
    button.className = extraClassName
        ? `flint-window-control ${extraClassName}`
        : "flint-window-control";
    button.dataset.flintWindowControl = control.id;

    button.addEventListener("pointerdown", stopHeaderInteraction);
    button.addEventListener("mousedown", stopHeaderInteraction);
    button.addEventListener("click", event => {
        stopHeaderInteraction(event);
        if (!button.disabled) {
            button.__flintControl?.onClick();
        }
    });

    applyControlState(button, control);
    return button;
}

export function renderWindowControls(
    host: HTMLElement,
    controls: readonly EditorWindowControl[],
    options: RenderWindowControlsOptions = {}
): void {
    const existingControls = new Map(
        [...host.querySelectorAll<WindowControlButton>(CONTROL_SELECTOR)]
            .map(button => [button.dataset.flintWindowControl, button] as const)
            .filter((entry): entry is readonly [string, WindowControlButton] => typeof entry[0] === "string")
    );
    const nextButtons: WindowControlButton[] = [];

    for (const control of controls) {
        const existingButton = existingControls.get(control.id);
        if (existingButton) {
            existingControls.delete(control.id);
            applyControlState(existingButton, control);
            nextButtons.push(existingButton);
        } else {
            nextButtons.push(createControlButton(control, options.extraClassName));
        }
    }

    for (const existingControl of existingControls) {
        existingControl[1].remove();
    }

    if (options.placement === "prepend") {
        host.prepend(...nextButtons);
    } else {
        host.append(...nextButtons);
    }
}
