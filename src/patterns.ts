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

const regexSpace = /\s/u;

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

const regexNumberStart = /\d/u;
const regexNumberContinue = /[\p{Alphabetic}\d_]/u;

export const enum NumberLikePatternState {
    Start,
    BeforeDot,
    Dot,
    AfterDot
}

export class NumberLikePattern implements Pattern<RawTokenType> {
    public state = NumberLikePatternState.Start;

    next(char: string): PatternResult<RawTokenType> {
        // Eof or whitespace means the end of the token
        if (char === undefined || regexSpace.test(char)) {
            return { isAlive: false };
        }

        switch (this.state) {
            case NumberLikePatternState.Start:
                if (regexNumberStart.test(char)) {
                    this.state = NumberLikePatternState.BeforeDot;
                    return { matchResult: RawTokenType.NumberLike, isAlive: true };
                }

                return { isAlive: false };

            case NumberLikePatternState.BeforeDot:
                if (char === ".") {
                    this.state = NumberLikePatternState.Dot;
                    return { isAlive: true };
                }

                if (regexNumberContinue.test(char)) {
                    return { matchResult: RawTokenType.NumberLike, isAlive: true };
                }

                return { isAlive: false };

            case NumberLikePatternState.Dot:
                if (regexNumberStart.test(char)) {
                    this.state = NumberLikePatternState.AfterDot;
                    return { matchResult: RawTokenType.NumberLike, isAlive: true };
                }

                return { isAlive: false };

            case NumberLikePatternState.AfterDot:
                if (regexNumberContinue.test(char)) {
                    return { matchResult: RawTokenType.NumberLike, isAlive: true };
                }

                return { isAlive: false };
        }
    }
}

const regexWordStart = /[\p{Alphabetic}_]/u;
const regexWordContinue = /[\p{Alphabetic}\d_]/u;

export class WordPattern implements Pattern<RawTokenType> {
    public isStart = true;

    next(char: string): PatternResult<RawTokenType> {
        // Eof or whitespace means the end of the token
        if (char === undefined || regexSpace.test(char)) {
            return { isAlive: false };
        }

        if (this.isStart) {
            if (regexWordStart.test(char)) {
                this.isStart = false;
                return { matchResult: RawTokenType.Word, isAlive: true };
            }

            return { isAlive: false };
        }

        if (regexWordContinue.test(char)) {
            return { matchResult: RawTokenType.Word, isAlive: true };
        }

        return { isAlive: false };
    }
}

const regexTimeStampContinue = /[_\-:\p{Alphabetic}\d.]/u;

export const enum TimeOrAmountLikePatternState {
    ForFirstChar,
    ForSecondChar,
    BeforeDot,
    Dot,
    AfterDot
}

export class TimeOrAmountLikePattern implements Pattern<RawTokenType> {
    public state = TimeOrAmountLikePatternState.ForFirstChar;
    public tokenType?: RawTokenType;

    next(char: string): PatternResult<RawTokenType> {
        // Eof or whitespace means the end of the token
        if (char === undefined || regexSpace.test(char)) {
            return { isAlive: false };
        }

        switch (this.state) {
            case TimeOrAmountLikePatternState.ForFirstChar:
                if (char === "@") {
                    this.state = TimeOrAmountLikePatternState.ForSecondChar;
                    this.tokenType = RawTokenType.DateTimeLike;
                    return { matchResult: this.tokenType, isAlive: true };
                } else if (char === "$") {
                    this.state = TimeOrAmountLikePatternState.BeforeDot;
                    this.tokenType = RawTokenType.AmountLike;
                    return { matchResult: this.tokenType, isAlive: true };
                }
                return { isAlive: false };

            case TimeOrAmountLikePatternState.ForSecondChar:
                if (char === "p" || char === "P") {
                    this.tokenType = RawTokenType.DeltaTimeLike;
                }
                this.state = TimeOrAmountLikePatternState.BeforeDot;
                // Fall through to check character validity in running state
            case TimeOrAmountLikePatternState.BeforeDot:
                if (char === ".") {
                    this.state = TimeOrAmountLikePatternState.Dot;
                    return { isAlive: true };
                }

                if (this.tokenType === RawTokenType.AmountLike) {
                    if (regexNumberContinue.test(char)) {
                        return { matchResult: this.tokenType, isAlive: true };
                    }
                } else if (this.tokenType === RawTokenType.DateTimeLike) {
                    if (regexTimeStampContinue.test(char)) {
                        return { matchResult: this.tokenType, isAlive: true };
                    }
                } else if (this.tokenType === RawTokenType.DeltaTimeLike) {
                    if (regexNumberContinue.test(char)) {
                        return { matchResult: this.tokenType, isAlive: true };
                    }
                }

                return { isAlive: false };
                
            case TimeOrAmountLikePatternState.Dot:
                if (regexNumberStart.test(char)) {
                    this.state = TimeOrAmountLikePatternState.AfterDot;
                    return { matchResult: this.tokenType, isAlive: true };
                }

                return { isAlive: false };

            case TimeOrAmountLikePatternState.AfterDot:
                if (this.tokenType === RawTokenType.AmountLike) {
                    if (regexNumberContinue.test(char)) {
                        return { matchResult: this.tokenType, isAlive: true };
                    }
                } else if (this.tokenType === RawTokenType.DateTimeLike) {
                    if (regexTimeStampContinue.test(char)) {
                        return { matchResult: this.tokenType, isAlive: true };
                    }
                } else if (this.tokenType === RawTokenType.DeltaTimeLike) {
                    if (regexNumberContinue.test(char)) {
                        return { matchResult: this.tokenType, isAlive: true };
                    }
                }
                return { isAlive: false };
        }
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

const regexSymbol = /[\p{Punctuation}\p{Symbol}]/u;

export class SymbolLikePattern implements Pattern<RawTokenType> {
    next(char: string): PatternResult<RawTokenType> {
        if (char === undefined || regexSpace.test(char)) {
            return { isAlive: false };
        }

        if (char === "\"" || char === "'" || char === "@" || char === "$" || char === "#") {
            return { isAlive: false };
        }

        if (regexSymbol.test(char)) {
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
            } else if (regexWordStart.test(char)) {
                this.pattern = new WordPattern();
            } else if (regexNumberStart.test(char)) {
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