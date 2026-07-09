import { describe, it, expect } from "vitest";
import { zip, zipLongest, enumerate } from "./iterables";

describe("iterables utility", () => {
    it("zips arrays to the length of the shortest array", () => {
        const a = [1, 2, 3];
        const b = ["a", "b"];
        const result = Array.from(zip(a, b));
        expect(result).toEqual([
            [1, "a"],
            [2, "b"]
        ]);
    });

    it("zips arrays to the length of the longest array using zipLongest", () => {
        const a = [1, 2, 3];
        const b = ["a", "b"];
        const result = Array.from(zipLongest(a, b));
        expect(result).toEqual([
            [1, "a"],
            [2, "b"],
            [3, undefined]
        ]);
    });

    it("enumerates an iterable with index", () => {
        const items = ["a", "b", "c"];
        const result = Array.from(enumerate(items));
        expect(result).toEqual([
            [0, "a"],
            [1, "b"],
            [2, "c"]
        ]);
    });
});
