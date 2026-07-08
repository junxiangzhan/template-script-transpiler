import { describe, it, expect } from "vitest";
import { CompilerContext } from "./context";

describe("CompilerContext", () => {
    it("collects diagnostics errors and warnings", () => {
        const context = new CompilerContext("hello world");
        expect(context.diagnostics).toEqual([]);

        context.warn("some warning", 0, 5);
        context.error("some error", 6, 5);

        expect(context.diagnostics).toEqual([
            { type: "warning", message: "some warning", offset: 0, length: 5 },
            { type: "error", message: "some error", offset: 6, length: 5 }
        ]);
    });

    it("gets source lexeme by offsets or token", () => {
        const context = new CompilerContext("hello world");
        expect(context.getLexeme(6, 5)).toBe("world");
        expect(context.getLexemeBy({ offset: 0, length: 5 })).toBe("hello");
    });
});
