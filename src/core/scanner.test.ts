import { describe, it, expect } from "vitest";
import { Scanner, Pattern, PatternResult } from "./scanner";
import { CompilerContext } from "./context";

class MockCharPattern implements Pattern<string> {
    next(char: string): PatternResult<string> {
        if (char === "a") {
            return { matchResult: "A_TOKEN", isAlive: false };
        }
        return { isAlive: false };
    }
}

describe("Scanner", () => {
    it("scans source using custom patterns", () => {
        const scanner = new Scanner<string>(() => new MockCharPattern());
        const context = new CompilerContext("  a  ");

        const token = scanner.next(context);
        expect(token).toEqual({
            type: "A_TOKEN",
            offset: 2,
            length: 1
        });

        expect(scanner.offset).toBe(3);
    });

    it("returns undefined at the end of input", () => {
        const scanner = new Scanner<string>(() => new MockCharPattern());
        const context = new CompilerContext("   ");

        const token = scanner.next(context);
        expect(token).toBeUndefined();
    });
});
