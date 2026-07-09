import { describe, it, expect } from "vitest";
import { Tokenizer } from "./tokenizer";
import { Scanner, Pattern, PatternResult } from "./scanner";
import { CompilerContext } from "./context";
import { Token } from "./token";

class MockPattern implements Pattern<string> {
    private count = 0;
    next(char: string): PatternResult<string> {
        this.count++;
        if (this.count === 1) {
            return { matchResult: char, isAlive: true };
        }
        return { isAlive: false };
    }
}

describe("Tokenizer", () => {
    it("skips specified tokens and refines raw tokens", () => {
        const skip = [" "];
        const refine = (rawToken: Token<string>) => {
            return {
                type: rawToken.type.toUpperCase(),
                offset: rawToken.offset,
                length: rawToken.length
            };
        };

        const scanner = new Scanner<string>(() => new MockPattern());
        const tokenizer = new Tokenizer<string, string>(refine, skip, scanner);

        const context = new CompilerContext("a b");

        const t1 = tokenizer.next(context);
        expect(t1).toEqual({ type: "A", offset: 0, length: 1 });

        const t2 = tokenizer.next(context);
        expect(t2).toEqual({ type: "B", offset: 2, length: 1 });
    });
});

