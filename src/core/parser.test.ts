import { describe, it, expect } from "vitest";
import { Parser, ParserStateType, ParsingRule, ParsingRuleResult } from "./parser";
import { Tokenizer } from "./tokenizer";
import { TokenMatcher, Token } from "./token";
import { CompilerContext } from "./context";

// Simple tokenizer mock that returns a fixed list of tokens
class ArrayTokenizer extends Tokenizer<string, string> {
    private tokens: Token<string>[];
    private index = 0;

    constructor(tokens: Token<string>[]) {
        super((t) => t, [], () => ({ next: () => ({ isAlive: false }) }));
        this.tokens = tokens;
    }

    override next(): Token<string> | undefined {
        if (this.index < this.tokens.length) {
            return this.tokens[this.index++];
        }
        return undefined;
    }
}

describe("Parser engine", () => {
    it("parses grammar rules using simple stack-based rules", () => {
        const tokens: Token<string>[] = [
            { type: "ID", offset: 0, length: 3 },
            { type: "ASSIGN", offset: 4, length: 1 },
            { type: "NUM", offset: 6, length: 2 }
        ];

        const tokenizer = new ArrayTokenizer(tokens);
        const matcher = new TokenMatcher<string>();
        const context = new CompilerContext<string>("foo = 42");

        const parser = new Parser<string, string, string>(tokenizer, matcher, context);

        const assignmentRule: ParsingRule<string, any, any, string> = {
            getRule() {
                return [
                    { type: ParserStateType.Token, tokenType: "ID" },
                    { type: ParserStateType.Token, tokenType: "ASSIGN" },
                    { type: ParserStateType.Token, tokenType: "NUM" }
                ] as const;
            },
            action(result: ParsingRuleResult<any>) {
                return {
                    type: "Assignment",
                    left: result[0],
                    right: result[2]
                };
            }
        };

        const result = parser.parse(assignmentRule);
        expect(result).toEqual({
            type: "Assignment",
            left: { type: "ID", offset: 0, length: 3 },
            right: { type: "NUM", offset: 6, length: 2 }
        });
    });
});
