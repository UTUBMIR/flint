export interface IVector {
    set(x: number, y: number): IVector;
    assign(other: IVector): IVector;

    copy(): IVector;

    add(other: IVector): IVector;

    subtract(other: IVector): IVector;

    multiply(other: IVector | number): IVector;

    divide(other: IVector | number): IVector;

    magnitude(): number;

    normalize(length: number): IVector

    clamp(min: IVector, max: IVector): IVector;

    equal(other: IVector): boolean;

    round(): IVector;
};