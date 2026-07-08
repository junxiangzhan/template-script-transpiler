import type { Pattern, ScannerContext } from "./scanner";
import type { Token } from "./token";
import type { SourceContext, DiagnosticCollector } from "./context";

import { Scanner } from "./scanner";

export interface TokenizerContext<R> extends ScannerContext {
    rawTokenBuffer: Token<R>[]; // maximum length of 1
}

export type TokenRefiner<T, R> = (rawToken: Token<R>, context: SourceContext & DiagnosticCollector, rawTokenBuffer: Token<R>[]) => Token<T> | undefined;

export class Tokenizer<T, R> {

    private scanner: Scanner<R>;

    private refineToken: TokenRefiner<T, R>;
    private skipTokenTypes: readonly R[];

    constructor(refineToken: TokenRefiner<T, R>, skipTokenTypes: readonly R[], createPattern: () => Pattern<R>) {
        this.scanner = new Scanner<R>(createPattern);
        this.refineToken = refineToken;
        this.skipTokenTypes = skipTokenTypes;
    }

    next(compilerContext: SourceContext & DiagnosticCollector, tokenizerContext: TokenizerContext<R>): Token<T> | undefined {
        let rawToken = tokenizerContext.rawTokenBuffer.pop() ?? this.scanner.next(compilerContext, tokenizerContext);

        // Skip specified token types
        while (rawToken && this.skipTokenTypes.includes(rawToken.type)) {
            rawToken = this.scanner.next(compilerContext, tokenizerContext);
        }

        if (!rawToken)
            return undefined;

        return this.refineToken(rawToken, compilerContext, tokenizerContext.rawTokenBuffer);
    }
}