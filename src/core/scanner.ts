import { Token } from "./token";
import { SourceContext } from "./context";

export interface PatternResult<TokenType> {
    matchResult?: TokenType;
    isAlive: boolean;
}

export interface Pattern<TokenType> {
    next(char: string): PatternResult<TokenType>;
}

export class Scanner<TokenType> {
    offset: number = 0;

    constructor(private createPattern: () => Pattern<TokenType>) {}

    next(compilerContext: SourceContext): Token<TokenType> | undefined {
        let peeked: string | undefined;

        while (true) {
            let offset = this.offset;
            let chars = compilerContext.getCharStream(offset);

            // Skip whitespaces
            while (peeked = chars.peek()) {
                if (/^\s$/.test(peeked)) {
                    offset++;
                    chars.next();
                } else {
                    break;
                }
            }

            // If we reached the end of the input, return undefined
            if (peeked === undefined) {
                this.offset = offset; // Update the scanner offset
                return undefined;
            }

            // try to match a token
            const startOffset = offset;
            let lastMatched: TokenType | undefined;
            let lastMatchedOffset = startOffset;

            const pattern = this.createPattern();

            while (peeked = chars.peek()) {
                const result = pattern.next(peeked);

                if (!result.isAlive)
                    break;

                chars.next();
                offset++;

                if (result.matchResult !== undefined) {
                    lastMatched = result.matchResult;
                    lastMatchedOffset = offset;
                }
            }

            // if we have a match, update the scanner context and return the token
            if (lastMatched !== undefined) {
                this.offset = lastMatchedOffset;

                return {
                    type: lastMatched,
                    offset: startOffset,
                    length: lastMatchedOffset - startOffset
                }
            } else {
                this.offset = offset; // Update the scanner offset

                // unexpected end of input or unexpected character
                // this case should not happen if the patterns are correctly defined to match all possible characters

                throw new Error(`[BUG] Pattern failed to handle lexical analysis at offset ${startOffset}.`)
            }
        }
    }
}