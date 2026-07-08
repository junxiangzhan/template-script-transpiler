import { describe, it, expect } from "vitest";
import { refineToken, RawTokenType, TokenType } from "./tokens";
import { CompilerContext } from "./core/context";

describe("Token refinement", () => {
    it("refines word token to correct keywords or identifier", () => {
        const context = new CompilerContext("template function myVar");
        
        const t1 = refineToken({ type: RawTokenType.Word, offset: 0, length: 8 }, context, []);
        expect(t1?.type).toBe(TokenType.KeywordTemplate);

        const t2 = refineToken({ type: RawTokenType.Word, offset: 9, length: 8 }, context, []);
        expect(t2?.type).toBe(TokenType.KeywordFunction);

        const t3 = refineToken({ type: RawTokenType.Word, offset: 18, length: 5 }, context, []);
        expect(t3?.type).toBe(TokenType.Identifier);
    });

    it("refines and validates number literals", () => {
        const context = new CompilerContext("10_000.25");
        const t = refineToken({ type: RawTokenType.NumberLike, offset: 0, length: 9 }, context, []);
        expect(t?.type).toBe(TokenType.NumberLiteral);
        expect(t?.isError).toBeFalsy();
    });
});
