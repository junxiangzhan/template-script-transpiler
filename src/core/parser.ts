import { CompilerContext, DiagnosticCollector, SourceContext } from "./context";
import { PeekableTokenStream, TokenMatcher, TokenMatchResult, TokenStream, type Token } from "./token";

type ParserStateValueResult<State> =
    State extends ParserRuleState<any, infer ReturnType> ? ReturnType
    : State extends ParserTokenState<infer TokenTypeValue, infer IsOptional> ? (
        IsOptional extends true ? Token<TokenTypeValue> | undefined
        : Token<TokenTypeValue>
    ) : never;

export type ParsingRuleResult<P extends readonly ParserState<any>[]> = {
    [K in keyof P]: ParserStateValueResult<P[K]>
};

export interface ParsingRule<SymbolType, TokenType, ReturnType, StateSequence extends readonly ParserState<any>[]> {
    rule(parser: PeekableTokenStream<TokenType>): StateSequence;
    action(result: ParsingRuleResult<StateSequence>, parser: PeekableTokenStream<TokenType>, context: CompilerContext<SymbolType>): ReturnType;
}

export const enum ParserStateType {
    Token,
    Rule,
    RuleAction
}

interface ParserStateBase {
    type: ParserStateType;
}

export interface ParserTokenState<TokenType, IsOptional extends boolean = boolean> extends ParserStateBase {
    type: ParserStateType.Token;
    tokenType: TokenType;
    onMissing?(context: SourceContext & DiagnosticCollector, butGot: Token<TokenType> | undefined): IsOptional extends true ? undefined : TokenType;
}

export type RecoveryCondition<T, R> = { peek?: readonly T[], consume?: readonly T[], action: (parser: PeekableTokenStream<T>, context: SourceContext & DiagnosticCollector) => R };

export interface ParserRuleState<TokenType, ReturnType> extends ParserStateBase {
    type: ParserStateType.Rule;
    rule: ParsingRule<any, TokenType, ReturnType, any>;
    recoveryWhen?: RecoveryCondition<TokenType, ReturnType>;
}

interface ParserActionState<TokenType, ReturnType> extends ParserStateBase {
    type: ParserStateType.RuleAction;
    rule: ParsingRule<any, TokenType, ReturnType, any>;
    recoveryWhen?: RecoveryCondition<TokenType, ReturnType>;
}

export type ParserState<TokenType> = ParserTokenState<any> | ParserRuleState<TokenType, any> | ParserActionState<TokenType, any>;

//

export class Parser<SymbolType, TokenType> implements PeekableTokenStream<TokenType> {

    private tokenBuffer: Token<TokenType>[] = [];

    constructor(
        public tokenizer: TokenStream<TokenType>,
        public tokenMatcher: TokenMatcher<TokenType>,
        public context: CompilerContext<SymbolType>
    ) { }

    public peek(): Token<TokenType> | undefined {
        if (this.tokenBuffer.length > 0) {
            return this.tokenBuffer[this.tokenBuffer.length - 1];
        }

        const token = this.tokenizer.next(this.context);

        if (token)
            this.tokenBuffer.push(token);

        return token;
    }

    public peekIf(types: readonly TokenType[]): Token<TokenType> | undefined {
        const token = this.peek();

        if (!token)
            return undefined;

        switch (this.tokenMatcher.match(token, types)) {
            case TokenMatchResult.Matched:
                return token;
            case TokenMatchResult.MatchedButSplit:
                const firstSplit = this.tokenMatcher.get(token.type)![0];
                return { ...firstSplit, offset: token.offset };
            case TokenMatchResult.Failed:
            case TokenMatchResult.FailedButMayMatchedAfterSplit:
                return undefined;
        }
    }

    private consumeToken(): Token<TokenType> | undefined {
        const token = this.peek();
        if (token)
            return this.tokenBuffer.pop();
    }

    private consumeTokenIf(types: readonly TokenType[]): Token<TokenType> | undefined {
        const token = this.peek();

        if (!token)
            return undefined;

        switch (this.tokenMatcher.match(token, types)) {
            case TokenMatchResult.Matched:
                return this.consumeToken();
            case TokenMatchResult.MatchedButSplit:
                const splitResult = this.tokenMatcher.get(token.type)!;
                const firstSplitToken = { ...splitResult[0], offset: token.offset };
                const secondSplitToken = { ...splitResult[1], offset: token.offset + splitResult[0].length };
                this.tokenBuffer[this.tokenBuffer.length - 1] = secondSplitToken; // Replace the current token with the second split token
                return firstSplitToken;
            case TokenMatchResult.Failed:
                return undefined;
            case TokenMatchResult.FailedButMayMatchedAfterSplit:
                return undefined;
        }
    }

    private consumeTokenUntil(whenConsume: readonly TokenType[], whenPeek: readonly TokenType[]): Token<TokenType>[] {
        if (whenConsume.length === 0 && whenPeek.length === 0)
            return [];

        const tokens: Token<TokenType>[] = [];

        while (true) {
            const token = this.peek();
            if (!token) return tokens;

            let split: boolean = false;
            let returnAfterConsume: boolean = false;

            switch (this.tokenMatcher.match(token, whenPeek)) {
                case TokenMatchResult.Matched:
                case TokenMatchResult.MatchedButSplit:
                    return tokens;
                case TokenMatchResult.FailedButMayMatchedAfterSplit:
                    split = true;
                    break; // Continue to consume the first split token
                case TokenMatchResult.Failed:
                    break; // Continue to consume the token
            }

            switch (this.tokenMatcher.match(token, whenConsume)) {
                case TokenMatchResult.Matched:
                    returnAfterConsume = true;
                    break;
                case TokenMatchResult.MatchedButSplit:
                    split = true;
                    returnAfterConsume = true;
                    break;
                case TokenMatchResult.FailedButMayMatchedAfterSplit:
                    split = true;
                    break;
                case TokenMatchResult.Failed:
                    break;
            }

            if (split) {
                const splitResult = this.tokenMatcher.get(token.type)!;
                const firstSplitToken = { ...splitResult[0], offset: token.offset };
                const secondSplitToken = { ...splitResult[1], offset: token.offset + splitResult[0].length };

                this.tokenBuffer.splice(
                    this.tokenBuffer.length - 1, 1, // Replace the current token with the second split token
                    secondSplitToken,
                    firstSplitToken
                );
            }

            tokens.push(this.consumeToken()!);

            if (returnAfterConsume) {
                return tokens;
            }
        }
    }

    public parse<StateSequence extends readonly ParserState<TokenType>[], ReturnType>(startRule: ParsingRule<SymbolType, TokenType, ReturnType, StateSequence>): ReturnType {

        const resultStacks: any[][] = [];
        let currentResults = [];

        const stateStack: ParserState<TokenType>[] = [{ type: ParserStateType.Rule, rule: startRule }];

        while (stateStack.length > 0) {
            const currentState = stateStack.pop()!;

            try {
                switch (currentState.type) {
                    case ParserStateType.Token:
                        const token = this.parseToken(currentState);
                        currentResults.push(token);
                        break;
                    case ParserStateType.Rule:
                        const states = currentState.rule.rule(this);

                        resultStacks.push(currentResults);
                        currentResults = [];

                        // Push a RuleAction state to handle the action after the rule states are processed
                        stateStack.push({
                            type: ParserStateType.RuleAction,
                            rule: currentState.rule,
                            recoveryWhen: currentState.recoveryWhen
                        });

                        // Push the states in reverse order so that they are processed in the correct order
                        for (let i = states.length - 1; i >= 0; i--)
                            stateStack.push(states[i]);
                        break;
                    case ParserStateType.RuleAction:
                        const previousResult = resultStacks.pop()!;
                        const actionResult = currentState.rule.action(currentResults as any[], this, this.context);
                        currentResults = previousResult;
                        currentResults.push(actionResult);
                        break;
                }
            } catch (error) {
                if (!(error instanceof ParserPanicError))
                    throw error;

                let recoveryState: ParserActionState<TokenType, any> | undefined;

                while (stateStack.length > 0 && !recoveryState) {
                    const currentState = stateStack.pop()!;

                    if (currentState.type !== ParserStateType.RuleAction)
                        continue;

                    // Discard the current result stack since we are recovering
                    currentResults = resultStacks.pop()!;

                    // Check if this state has a recovery condition
                    if (!currentState.recoveryWhen)
                        continue;

                    recoveryState = currentState;
                }

                if (!recoveryState)
                    throw error; // No recovery state found, rethrow the error

                const { peek, consume, action } = recoveryState.recoveryWhen!;

                this.consumeTokenUntil(consume ?? [], peek ?? []);

                const recoveryResult = action(this, this.context);
                currentResults.push(recoveryResult); // push the recovery result as this rule's result
            }
        }

        if (currentResults.length !== 1) {
            throw new Error(`[BUG] Parsing did not result in a single root node. Result stack: ${JSON.stringify(currentResults)}`);
        }

        return currentResults[0];
    }

    private parseToken(state: ParserTokenState<TokenType>): Token<TokenType> | undefined {
        const token = this.consumeTokenIf([state.tokenType]);

        if (token)
            return token;

        const butGot = this.peek();
        if (state.onMissing) {
            const missingTokenType = state.onMissing(this.context, butGot);

            if (missingTokenType !== undefined) {
                return {
                    type: missingTokenType,
                    offset: butGot?.offset ?? this.context.source.length,
                    length: butGot?.length ?? 0,
                    isMissing: true
                };
            } else {
                // this token is explicitly optional, so we just skip it and return undefined
                return undefined;
            }
        }

        // If we reach here, it means the token was not found and there is no onMissing handler, so we throw an error
        const errorMessage = `Expected token of type ${state.tokenType} but got ${butGot ? butGot.type : "end of input"}`;

        this.context.error(errorMessage, butGot?.offset, butGot?.length);

        throw new ParserPanicError(`[BUG] Parser encountered an unexpected token. ${errorMessage}`);
    }
}

export class ParserPanicError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ParserPanicError";
    }
}