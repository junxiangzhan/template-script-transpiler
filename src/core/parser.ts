import { CompilerContext, DiagnosticCollector, SourceContext } from "./context";
import { SymbolTable } from "./symbol-table";
import { TokenMatcher, TokenMatchResult, type Token } from "./token";
import { type TokenizerContext, Tokenizer } from "./tokenizer";


type ParserStates<T> = readonly ParserState<T>[];

type ParserStateValueResult<State> =
    State extends ParserRuleState<any, infer R> ? R
    : State extends ParserTokenState<infer TokenTypeValue, infer IsOptional>
        ? (IsOptional extends true ? Token<TokenTypeValue> | undefined : Token<TokenTypeValue>)
        : never;

export type ParsingRuleResult<P extends ParserStates<any>> = {
    [K in keyof P]: ParserStateValueResult<P[K]>
};

export interface ParsingRule<T, P extends ParserStates<T>, R, S> {
    getRule(parser: PeekableTokenStream<T>): P;
    action(result: ParsingRuleResult<P>, parser: PeekableTokenStream<T>, context: CompilerContext<S>): R;
}

export const enum ParserStateType {
    Token,
    Rule,
    RuleAction
}

interface ParserStateBase {
    type: ParserStateType;
}

export interface ParserTokenState<T, IsOptional extends boolean = boolean> extends ParserStateBase {
    type: ParserStateType.Token;
    tokenType: T;
    onMissing?(parser: PeekableTokenStream<T>, context: SourceContext & DiagnosticCollector, butGot: Token<T> | undefined): IsOptional extends true ? undefined : T;
}

export type RecoveryCondition<T, R> = { peek?: readonly T[], consume?: readonly T[], action: (parser: PeekableTokenStream<T>, context: SourceContext & DiagnosticCollector) => R };

export interface ParserRuleState<T, R> extends ParserStateBase {
    type: ParserStateType.Rule;
    rule: ParsingRule<T, any, R, any>;
    recoveryWhen?: RecoveryCondition<T, R>;
}

interface ParserActionState<T, R> extends ParserStateBase {
    type: ParserStateType.RuleAction;
    rule: ParsingRule<T, any, R, any>;
    recoveryWhen?: RecoveryCondition<T, R>;
}

type ParserState<T> = ParserTokenState<any> | ParserRuleState<T, any> | ParserActionState<T, any>;

//

export class ParserContext<T, R> implements TokenizerContext<R> {
    public offset: number = 0;
    public rawTokenBuffer: Token<R>[] = [];
    public tokenBuffer: Token<T>[] = [];
}

export interface PeekableTokenStream<T> extends ParserContext<T, unknown> {
    peek(): Token<T> | undefined;
    peekIf(types: readonly T[]): Token<T> | undefined;
}

export class Parser<T, R, S> extends ParserContext<T, R> implements PeekableTokenStream<T> {

    public tokenizer: Tokenizer<T, R>;
    public context: CompilerContext<S>;

    public tokenMatcher: TokenMatcher<T> = new TokenMatcher<T>();

    constructor(tokenizer: Tokenizer<T, R>, tokenMatcher: TokenMatcher<T>, context: CompilerContext<S>) {
        super();
        this.tokenizer = tokenizer;
        this.tokenMatcher = tokenMatcher;
        this.context = context;
    }

    public peek(): Token<T> | undefined {
        if (this.tokenBuffer.length > 0) {
            return this.tokenBuffer[this.tokenBuffer.length - 1];
        }

        const token = this.tokenizer.next(this.context, this);

        if (token)
            this.tokenBuffer.push(token);

        return token;
    }

    public peekIf(types: readonly T[]): Token<T> | undefined {
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

    private consumeToken(): Token<T> | undefined {
        const token = this.peek();
        if (token)
            return this.tokenBuffer.pop();
    }

    private consumeTokenIf(types: readonly T[]): Token<T> | undefined {
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

    private consumeTokenUntil(whenConsume: readonly T[], whenPeek: readonly T[]): Token<T>[] {
        if (whenConsume.length === 0 && whenPeek.length === 0)
            return [];

        const tokens: Token<T>[] = [];

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

    public parse<P extends ParserStates<T>, R>(startRule: ParsingRule<T, P, R, S>): R {
        
        const resultStacks: any[][] = [];
        let currentResults = [];

        const stateStack: ParserState<T>[] = [{ type: ParserStateType.Rule, rule: startRule }];

        while (stateStack.length > 0) {
            const currentState = stateStack.pop()!;

            try {
                switch (currentState.type) {
                case ParserStateType.Token:
                    const token = this.parseToken(currentState);
                    currentResults.push(token);
                    break;
                case ParserStateType.Rule:
                    const states = currentState.rule.getRule(this);
                    
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

                let recoveryState: ParserActionState<T, any> | undefined;

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

    private parseToken(state: ParserTokenState<T>): Token<T> | undefined {
        const token = this.consumeTokenIf([state.tokenType]);

        if (token)
            return token;

        const butGot = this.peek();
        if (state.onMissing) {
            const missingTokenType = state.onMissing(this, this.context, butGot);

            if (missingTokenType !== undefined) {
                return { 
                    type: missingTokenType, 
                    offset: butGot?.offset ?? this.offset,
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

        this.context.error(
            errorMessage,
            butGot?.offset ?? this.offset,
            butGot?.length ?? 0
        );

        throw new ParserPanicError(`[BUG] Parser encountered an unexpected token. ${errorMessage}`);
    }
}

export class ParserPanicError extends Error {
    constructor(message: string) {
        super(message);
        this.name = "ParserPanicError";
    }
}