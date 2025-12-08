export interface IVector {
    set(x: number, y: number): IVector;
    copy(): IVector;

    add(other: IVector): IVector;

    subtract(other: IVector): IVector;

    multiply(other: IVector | number): IVector;

    divide(other: IVector | number): IVector;

    magnitude(): number;

    normalize(length: number): IVector

    clamp(min: IVector, max: IVector): IVector;
};