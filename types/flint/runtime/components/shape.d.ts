import Component from "../component";
import type { IRenderer } from "../../shared/irenderer";
export default class Shape extends Component {
    private fillColor;
    private lineColor;
    private shadowColor;
    onRender(renderer: IRenderer): void;
}
