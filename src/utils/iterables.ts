
type Zipped<T extends readonly unknown[][]> = {
    [K in keyof T]: T[K] extends readonly (infer U)[] ? U : never;
}[];

type ZippedLongest<T extends readonly unknown[][]> = {
    [K in keyof T]: T[K] extends readonly (infer U)[] ? U | undefined : never;
}[];

export function* zip<T extends readonly unknown[][]>(...arrays: T): Iterable<Zipped<T>[number]> {
    const minLength = Math.min(...arrays.map(arr => arr.length));
    
    for (let i = 0; i < minLength; i++) {
        yield arrays.map(arr => arr[i]) as Zipped<T>[number];
    }
}

export function* zipLongest<T extends readonly unknown[][]>(...arrays: T): Iterable<ZippedLongest<T>[number]> {
    const maxLength = Math.max(...arrays.map(arr => arr.length));
    
    for (let i = 0; i < maxLength; i++) {
        yield arrays.map(arr => arr[i]) as ZippedLongest<T>[number];
    }
}

export function* enumerate<T>(iterable: Iterable<T>): Iterable<[number, T]> {
    let index = 0;

    for (const item of iterable) {
        yield [index++, item];
    }
}