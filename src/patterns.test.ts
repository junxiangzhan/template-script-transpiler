import { describe, it, expect } from "vitest";
import { WordPattern, NumberLikePattern, StringLikePattern, SymbolLikePattern } from "./patterns";
import { RawTokenType } from "./tokens";

describe("Lexer patterns", () => {
    it("WordPattern parses standard words", () => {
        const pattern = new WordPattern();
        expect(pattern.next("a")).toEqual({ matchResult: RawTokenType.Word, isAlive: true });
        expect(pattern.next("1")).toEqual({ matchResult: RawTokenType.Word, isAlive: true });
        expect(pattern.next("_")).toEqual({ matchResult: RawTokenType.Word, isAlive: true });
        expect(pattern.next("(")).toEqual({ isAlive: false });
    });

    it("NumberLikePattern parses digits and underscores", () => {
        const pattern = new NumberLikePattern();
        expect(pattern.next("1")).toEqual({ matchResult: RawTokenType.NumberLike, isAlive: true });
        expect(pattern.next("_")).toEqual({ matchResult: RawTokenType.NumberLike, isAlive: true });
        expect(pattern.next("0")).toEqual({ matchResult: RawTokenType.NumberLike, isAlive: true });
        expect(pattern.next(".")).toEqual({ isAlive: true });
        expect(pattern.next("5")).toEqual({ matchResult: RawTokenType.NumberLike, isAlive: true });
        expect(pattern.next(";")).toEqual({ isAlive: false });
    });

    it("StringLikePattern parses quoted strings", () => {
        const pattern = new StringLikePattern();
        expect(pattern.next('"')).toEqual({ matchResult: RawTokenType.InvalidString, isAlive: true });
        expect(pattern.next('h')).toEqual({ matchResult: RawTokenType.InvalidString, isAlive: true });
        expect(pattern.next('"')).toEqual({ matchResult: RawTokenType.StringLike, isAlive: false });
    });

    it("SymbolLikePattern parses punctuation and stops on pattern starters", () => {
        const pattern = new SymbolLikePattern();
        expect(pattern.next("=")).toEqual({ matchResult: RawTokenType.SymbolLike, isAlive: true });
        expect(pattern.next('"')).toEqual({ isAlive: false });
    });
});
