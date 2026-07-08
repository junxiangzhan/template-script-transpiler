
export interface Peekable<T> {
    peek(): T | undefined;
    next(): T | undefined;
}

export class PeekableString implements Peekable<string> {
    string: string;
    offset: number;

    constructor(string: string, offset: number = 0) {
        this.string = string;
        this.offset = offset;
    }

    public peek(): string | undefined {
        if (this.offset < this.string.length) {
            return this.string[this.offset];
        }
        return undefined;
    }

    public next(): string | undefined {
        if (this.offset < this.string.length) {
            return this.string[this.offset++];
        }
        return undefined;
    }
}