import { Token } from "./token";
import { SourceContext } from "./context";

export interface PatternResult<T> {
    matchResult?: T;
    isAlive: boolean;
}

export interface Pattern<T> {
    next(char: string): PatternResult<T>;
}

export interface ScannerContext {
    offset: number;
}

export class Scanner<T> {
    
    constructor(private createPattern: () => Pattern<T>) {}

    next(compilerContext: SourceContext, scannerContext: ScannerContext): Token<T> | undefined {
        let peeked: string | undefined;

        while (true) {
            let offset = scannerContext.offset;
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
                scannerContext.offset = offset; // Update the scanner context offset
                return undefined;
            }

            // try to match a token
            const startOffset = offset;
            let lastMatched: T | undefined;
            let lastMatchedOffset = startOffset;

            const pattern = this.createPattern();

            while (peeked = chars.peek()) {
                const result = pattern.next(peeked);

                chars.next();
                offset++;

                if (result.matchResult !== undefined) {
                    lastMatched = result.matchResult;
                    lastMatchedOffset = offset;
                }

                if (!result.isAlive)
                    break;
            }

            // if we have a match, update the scanner context and return the token
            if (lastMatched !== undefined) {
                scannerContext.offset = lastMatchedOffset;

                return {
                    type: lastMatched,
                    offset: startOffset,
                    length: lastMatchedOffset - startOffset
                }
            } else {
                scannerContext.offset = offset; // Update the scanner context offset
                
                // unexpected end of input or unexpected character
                // this case should not happen if the patterns are correctly defined to match all possible characters

                throw new Error(`[BUG] Pattern failed to handle lexical analysis at offset ${startOffset}.`)
            }
        }
    }
}