import type { SourceContext, DiagnosticCollector } from "./context";
import type { Token, TokenStream } from "./token";
import type { Scanner } from "./scanner";

export type TokenRefiner<T, R> = (rawToken: Token<R>, context: SourceContext & DiagnosticCollector, rawTokenBuffer: Token<R>[]) => Token<T> | undefined;

export class Tokenizer<TokenType, RawTokenType> implements TokenStream<TokenType> {

    private rawTokenBuffer: Token<RawTokenType>[] = [];

    constructor(
        private refineToken: TokenRefiner<TokenType, RawTokenType>,
        private skipTokenTypes: readonly RawTokenType[],
        private scanner: Scanner<RawTokenType>
    ) { }

    next(compilerContext: SourceContext & DiagnosticCollector): Token<TokenType> | undefined {
        let rawToken = this.rawTokenBuffer.pop() ?? this.scanner.next(compilerContext);

        // Skip specified token types
        while (rawToken && this.skipTokenTypes.includes(rawToken.type)) {
            rawToken = this.scanner.next(compilerContext);
        }

        if (!rawToken)
            return undefined;

        return this.refineToken(rawToken, compilerContext, this.rawTokenBuffer);
    }
}