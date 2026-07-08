import { describe, it, expect } from "vitest";
import { PeekableString } from "./peekable";

describe("peekable utility", () => {
    it("peeks and advances string correctly", () => {
        const peekable = new PeekableString("abc", 0);
        expect(peekable.peek()).toBe("a");
        expect(peekable.next()).toBe("a");
        expect(peekable.peek()).toBe("b");
        expect(peekable.next()).toBe("b");
        expect(peekable.peek()).toBe("c");
        expect(peekable.next()).toBe("c");
        expect(peekable.peek()).toBeUndefined();
        expect(peekable.next()).toBeUndefined();
    });

    it("can start from offset", () => {
        const peekable = new PeekableString("abc", 1);
        expect(peekable.peek()).toBe("b");
        expect(peekable.next()).toBe("b");
    });
});
