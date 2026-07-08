import { RawTokenType } from "./tokens";
import type { Pattern, PatternResult } from "./core/scanner";

export const enum StringLikePatternState {
    Start,
    InString,
    Escaping,
    End
}

export const enum StringLikePatternQuoteType {
    DoubleQuote,
    SingleQuote
}

export class StringLikePattern implements Pattern<RawTokenType> {
    public quoteType = StringLikePatternQuoteType.DoubleQuote;
    public state = StringLikePatternState.Start;

    next(char: string): PatternResult<RawTokenType> {
        switch (this.state) {
            case StringLikePatternState.Start:
                if (char === "\"") {
                    this.quoteType = StringLikePatternQuoteType.DoubleQuote;
                    this.state = StringLikePatternState.InString;
                    return { matchResult: RawTokenType.InvalidString, isAlive: true };
                } else if (char === "'") {
                    this.quoteType = StringLikePatternQuoteType.SingleQuote;
                    this.state = StringLikePatternState.InString;
                    return { matchResult: RawTokenType.InvalidIdentifierString, isAlive: true };
                } else {
                    return { isAlive: false };
                }
            case StringLikePatternState.InString:
                if (char === "\\") {
                    this.state = StringLikePatternState.Escaping;
                    return { matchResult: RawTokenType.InvalidString, isAlive: true };
                }

                if (this.quoteType === StringLikePatternQuoteType.DoubleQuote && char === "\"") {
                    this.state = StringLikePatternState.End;
                    return { matchResult: RawTokenType.StringLike, isAlive: false };
                } else if (this.quoteType === StringLikePatternQuoteType.SingleQuote && char === "'") {
                    this.state = StringLikePatternState.End;
                    return { matchResult: RawTokenType.IdentifierStringLike, isAlive: false };
                }

                return { matchResult: RawTokenType.InvalidString, isAlive: true };
            case StringLikePatternState.Escaping:
                this.state = StringLikePatternState.InString;

                if (this.quoteType === StringLikePatternQuoteType.DoubleQuote) {
                    return { matchResult: RawTokenType.InvalidString, isAlive: true };
                } else if (this.quoteType === StringLikePatternQuoteType.SingleQuote) {
                    return { matchResult: RawTokenType.InvalidIdentifierString, isAlive: true };
                }
            case StringLikePatternState.End:
            default:
                return { isAlive: false };
        }
    }
}

export const enum NumberLikePatternState {
    Start,
    Sign,
    BeforeDot,
    AfterDot
}

export class NumberLikePattern implements Pattern<RawTokenType> {
    public state = NumberLikePatternState.Start;

    next(char: string): PatternResult<RawTokenType> {
        // Eof or whitespace means the end of the token
        if (char === undefined || /\s/u.test(char)) {
            return { isAlive: false };
        }

        switch (this.state) {
            case NumberLikePatternState.Start:
                if (char === "+" || char === "-") {
                    this.state = NumberLikePatternState.Sign;
                    return { isAlive: true };
                }

                if (/\d/u.test(char)) {
                    this.state = NumberLikePatternState.BeforeDot;
                    return { matchResult: RawTokenType.NumberLike, isAlive: true };
                }

                return { isAlive: false };
            case NumberLikePatternState.Sign:
                if (/\d/u.test(char)) {
                    this.state = NumberLikePatternState.BeforeDot;
                    return { matchResult: RawTokenType.NumberLike, isAlive: true };
                }

                return { isAlive: false };

            case NumberLikePatternState.BeforeDot:
                if (char === ".") {
                    this.state = NumberLikePatternState.AfterDot;
                    return { isAlive: true };
                }

                if (/\d/u.test(char) || char === "_") {
                    return { matchResult: RawTokenType.NumberLike, isAlive: true };
                }

                return { isAlive: false };

            case NumberLikePatternState.AfterDot:
                if (/\d/u.test(char) || char === "_") {
                    return { matchResult: RawTokenType.NumberLike, isAlive: true };
                }

                return { isAlive: false };
        }
    }
}

export class WordPattern implements Pattern<RawTokenType> {
    public isStart = true;

    next(char: string): PatternResult<RawTokenType> {
        // Eof or whitespace means the end of the token
        if (char === undefined || /\s/u.test(char)) {
            return { isAlive: false };
        }

        if (this.isStart) {
            if (/\p{Alphabetic}/u.test(char)) {
                this.isStart = false;
                return { matchResult: RawTokenType.Word, isAlive: true };
            }

            return { isAlive: false };
        }

        if (/[\p{Alphabetic}\d_]/u.test(char)) {
            return { matchResult: RawTokenType.Word, isAlive: true };
        }

        return { isAlive: false };
    }
}

export const enum TimeOrAmountLikePatternState {
    ForFirstChar,
    ForSecondChar,
    Running
}

export class TimeOrAmountLikePattern implements Pattern<RawTokenType> {
    public state = TimeOrAmountLikePatternState.ForFirstChar;
    public tokenType?: RawTokenType;

    next(char: string): PatternResult<RawTokenType> {
        // Eof or whitespace means the end of the token
        if (char === undefined || /\s/u.test(char)) {
            return { isAlive: false };
        }

        switch (this.state) {
            case TimeOrAmountLikePatternState.ForFirstChar:
                if (char === "@") {
                    this.state = TimeOrAmountLikePatternState.ForSecondChar;
                    this.tokenType = RawTokenType.DateTimeLike;
                    return { matchResult: this.tokenType, isAlive: true };
                } else if (char === "$") {
                    this.state = TimeOrAmountLikePatternState.Running;
                    this.tokenType = RawTokenType.AmountLike;
                    return { matchResult: this.tokenType, isAlive: true };
                }
                return { isAlive: false };

            case TimeOrAmountLikePatternState.ForSecondChar:
                if (char === "p" || char === "P") {
                    this.tokenType = RawTokenType.DeltaTimeLike;
                }
                this.state = TimeOrAmountLikePatternState.Running;
                // Fall through to check character validity in running state
            case TimeOrAmountLikePatternState.Running:
                if (this.tokenType === RawTokenType.AmountLike) {
                    if (/[\d_.]/u.test(char)) {
                        return { matchResult: this.tokenType, isAlive: true };
                    }
                } else if (this.tokenType === RawTokenType.DateTimeLike || this.tokenType === RawTokenType.DeltaTimeLike) {
                    if (/[a-zA-Z0-9_.:-]/u.test(char)) {
                        return { matchResult: this.tokenType, isAlive: true };
                    }
                }
                return { isAlive: false };
        }
        return { isAlive: false };
    }
}

export class TriviaPattern implements Pattern<RawTokenType> {
    public isStart = true;

    next(char: string): PatternResult<RawTokenType> {
        if (char === undefined || char === "\n") {
            return { isAlive: false };
        }

        if (this.isStart) {
            if (char === "#") {
                this.isStart = false;
                return { matchResult: RawTokenType.Trivia, isAlive: true };
            } else {
                return { isAlive: false };
            }
        }

        return { matchResult: RawTokenType.Trivia, isAlive: true };
    }
}

export class SymbolLikePattern implements Pattern<RawTokenType> {
    next(char: string): PatternResult<RawTokenType> {
        if (char === undefined || /\s/u.test(char)) {
            return { isAlive: false };
        }

        if (char === "\"" || char === "'" || char === "@" || char === "$" || char === "#") {
            return { isAlive: false };
        }

        if (/[\p{Punctuation}\p{Symbol}]/u.test(char)) {
            return { matchResult: RawTokenType.SymbolLike, isAlive: true };
        }

        return { isAlive: false };
    }
}

export class DispatchPattern implements Pattern<RawTokenType> {
    public pattern?: Pattern<RawTokenType>;

    next(char: string): PatternResult<RawTokenType> {
        if (!this.pattern) {
            if (char === "\"" || char === "'") {
                this.pattern = new StringLikePattern();
            } else if (char === "@" || char === "$") {
                this.pattern = new TimeOrAmountLikePattern();
            } else if (/\p{Alphabetic}/u.test(char)) {
                this.pattern = new WordPattern();
            } else if (/\d/u.test(char)) {
                this.pattern = new NumberLikePattern();
            } else if (char === "#") {
                this.pattern = new TriviaPattern();
            } else {
                this.pattern = new SymbolLikePattern();
            }
        }

        if (this.pattern) {
            const result = this.pattern.next(char);
            return result;
        }

        return { isAlive: false };
    }
}