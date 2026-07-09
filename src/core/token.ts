import { DiagnosticCollector, SourceContext } from "./context";

export interface Token<T> {
    type: T;
    offset: number;
    length: number;
    isMissing?: boolean; // Indicates if the token was expected but missing in the source code
    isError?: boolean;   // Indicates if the token represents an error (e.g., invalid token)
}

export const enum TokenMatchResult {
    Matched,
    MatchedButSplit,
    Failed,
    FailedButMayMatchedAfterSplit
}

export interface TokenSplitResult<T> {
    type: T;
    length: number;
}

export class TokenMatcher<T> extends Map<T, [TokenSplitResult<T>, TokenSplitResult<T>]> {

    match(token: Token<T> | undefined, expectedTypes: readonly T[]): TokenMatchResult {
        if (!token)
            return TokenMatchResult.Failed;

        if (expectedTypes.includes(token.type))
            return TokenMatchResult.Matched;

        const splitResult = this.get(token.type);
        if (splitResult) {
            const firstSplit = splitResult[0];
            if (expectedTypes.includes(firstSplit.type)) {
                return TokenMatchResult.MatchedButSplit;
            }

            const splitTokens = [splitResult[1], splitResult[0]];
            do {
                const nextSplit = splitTokens.pop()!;

                if (expectedTypes.includes(nextSplit.type)) {
                    return TokenMatchResult.FailedButMayMatchedAfterSplit;
                }

                if (this.has(nextSplit.type)) {
                    const furtherSplit = this.get(nextSplit.type)!;
                    splitTokens.push(furtherSplit[1], furtherSplit[0]);
                }
            } while (splitTokens.length > 0);
        }

        return TokenMatchResult.Failed;
    }
}

export interface TokenStream<TokenType> {
    next(compilerContext: SourceContext & DiagnosticCollector): Token<TokenType> | undefined;
}

export interface PeekableTokenStream<T> {
    peek(): Token<T> | undefined;
    peekIf(types: readonly T[]): Token<T> | undefined;
}
