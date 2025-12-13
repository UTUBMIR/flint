import type { IRenderer } from "../../shared/irenderer";
import RendererComponent from "../renderer-component";
export default class Shape extends RendererComponent {
    private fillColor;
    private lineColor;
    private shadowColor;
    render(renderer: IRenderer): void;
}
