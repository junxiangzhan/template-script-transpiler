import { SourceContext, DiagnosticCollector } from "./core/context";
import { Token, TokenMatcher } from "./core/token";

import { singleQuoteToDoubleQuote, parseDateTime, parseDuration } from "./utils/literals";

export const enum RawTokenType {
    Word,
    NumberLike,
    DateTimeLike,
    DeltaTimeLike,
    AmountLike,
    StringLike,
    InvalidString,
    IdentifierStringLike,
    InvalidIdentifierString,
    SymbolLike,
    Trivia
}

export const skipTokenTypes = [
    RawTokenType.Trivia
] as const;

export const enum TokenType {
    // keywords for control flow
    KeywordFunction,
    KeywordTemplate,
    KeywordDo,
    KeywordIf,
    KeywordElse,
    KeywordFor,
    KeywordIn,
    KeywordWhile,
    KeywordReturn,
    KeywordNew,

    // keywords for literals
    KeywordTrue,
    KeywordFalse,
    KeywordNull,
    KeywordUndefined,

    // symbol operators
    OperatorPlus,
    OperatorMinus,
    OperatorMultiply,
    OperatorDivide,
    OperatorFloorDivide,
    OperatorModulo,
    OperatorConcat,
    OperatorEqual,
    OperatorNotEqual,
    OperatorLessThan,
    OperatorLessThanOrEqual,
    OperatorGreaterThan,
    OperatorGreaterThanOrEqual,
    OperatorAnd,
    OperatorOr,
    OperatorXor,
    OperatorNot,
    OperatorAssign,

    // keyword operators
    OperatorFloor,
    OperatorReverse,
    OperatorAbsolute,

    // punctuation
    SymbolLeftParen,
    SymbolRightParen,
    SymbolLeftBracket,
    SymbolRightBracket,
    SymbolLeftBrace,
    SymbolRightBrace,
    SymbolDoubleLeftBrace,
    SymbolDoubleRightBrace,
    SymbolComma,
    SymbolColon,
    SymbolSemicolon,
    SymbolDot,

    // literals
    StringLiteral,
    NumberLiteral,
    DateTimeLiteral,
    DeltaTimeLiteral,
    AmountLiteral,

    // identifiers
    Identifier,
    StringIdentifier,

    // errors
    UnknownSymbol
}

export const infixOperatorTokenTypes = [
    TokenType.OperatorPlus,
    TokenType.OperatorMinus,
    TokenType.OperatorMultiply,
    TokenType.OperatorDivide,
    TokenType.OperatorFloorDivide,
    TokenType.OperatorModulo,
    TokenType.OperatorConcat,

    // Comparison operators
    TokenType.OperatorEqual,
    TokenType.OperatorNotEqual,
    TokenType.OperatorLessThan,
    TokenType.OperatorLessThanOrEqual,
    TokenType.OperatorGreaterThan,
    TokenType.OperatorGreaterThanOrEqual,

    // Logical operators
    TokenType.OperatorAnd,
    TokenType.OperatorOr,
    TokenType.OperatorXor,

    // Assignment operator
    TokenType.OperatorAssign
] as const;

export type InfixOperator = typeof infixOperatorTokenTypes[number];

export const prefixOperatorTokenTypes = [
    TokenType.OperatorMinus,
    TokenType.OperatorNot,
    TokenType.OperatorFloor,
    TokenType.OperatorReverse,
    TokenType.OperatorAbsolute
] as const;

export type PrefixOperator = typeof prefixOperatorTokenTypes[number];

export const identifierTokenTypes = [
    TokenType.Identifier,
    TokenType.StringIdentifier
] as const;

export type Identifier = typeof identifierTokenTypes[number];

export const literalTokenTypes = [
    TokenType.StringLiteral,
    TokenType.NumberLiteral,
    TokenType.DateTimeLiteral,
    TokenType.DeltaTimeLiteral,
    TokenType.AmountLiteral,

    TokenType.KeywordTrue,
    TokenType.KeywordFalse,
    TokenType.KeywordNull,
    TokenType.KeywordUndefined
];

export type Literal = typeof literalTokenTypes[number];

export const expressionFirstTokenTypes = [
    TokenType.KeywordDo,
    TokenType.KeywordIf,
    TokenType.KeywordFor,
    TokenType.KeywordWhile,
    TokenType.KeywordReturn,
    TokenType.KeywordNew,

    ...prefixOperatorTokenTypes,     // for unary operations
    ...identifierTokenTypes,
    
    TokenType.StringLiteral,
    TokenType.NumberLiteral,
    TokenType.DateTimeLiteral,
    TokenType.DeltaTimeLiteral,
    TokenType.AmountLiteral,
    TokenType.SymbolLeftParen,       // for grouping
    TokenType.SymbolLeftBracket,     // for array literals
    TokenType.SymbolDoubleLeftBrace, // for object literals

    TokenType.KeywordTrue,
    TokenType.KeywordFalse,
    TokenType.KeywordNull,
    TokenType.KeywordUndefined
];

//

export function getWordTokenType(word: string): TokenType {
    switch (word) {
        case "function": return TokenType.KeywordFunction;
        case "template": return TokenType.KeywordTemplate;
        case "do": return TokenType.KeywordDo;
        case "if": return TokenType.KeywordIf;
        case "else": return TokenType.KeywordElse;
        case "for": return TokenType.KeywordFor;
        case "in": return TokenType.KeywordIn;
        case "while": return TokenType.KeywordWhile;
        case "return": return TokenType.KeywordReturn;
        case "new": return TokenType.KeywordNew;

        case "true": return TokenType.KeywordTrue;
        case "false": return TokenType.KeywordFalse;
        case "null": return TokenType.KeywordNull;
        case "undefined": return TokenType.KeywordUndefined;

        case "int": return TokenType.OperatorFloor;
        case "rev": return TokenType.OperatorReverse;
        case "abs": return TokenType.OperatorAbsolute;

        default: return TokenType.Identifier;
    }
}

export function isValidStringLiteral(literal: string): boolean {
    if (literal.length < 2 || !literal.startsWith("\"") || !literal.endsWith("\""))
        return false;

    try {
        const content = JSON.parse(literal);

        let insidePlaceholder = false;
        for (const char of content) {
            if (char === "%")
                insidePlaceholder = !insidePlaceholder;
        }

        return !insidePlaceholder;
    } catch {
        return false;
    }
}

export function isValidIdentifierStringLiteral(literal: string): boolean {
    if (literal.length < 2 || !literal.startsWith("'") || !literal.endsWith("'"))
        return false;

    try {
        const converted = singleQuoteToDoubleQuote(literal);
        const content = JSON.parse(converted);

        let insidePlaceholder = false;
        for (const char of content) {
            if (char === "%") {
                insidePlaceholder = !insidePlaceholder;
            } else if (char === "." && !insidePlaceholder) {
                return false;
            }
        }

        return !insidePlaceholder;
    } catch {
        return false;
    }
}

export function isValidNumberLiteral(literal: string): boolean {
    return /^\d+(\.\d+)?$/.test(literal.replace(/_/g, ""));
}

export function isValidAmountLiteral(literal: string): boolean {
    return /^\$\d+(\.\d+)?$/.test(literal.replace(/_/g, ""));
}

export function isValidDateTimeLiteral(literal: string): boolean {
    if (!literal.startsWith("@"))
        return false;

    try {
        parseDateTime(literal.slice(1));
        return true;
    } catch {
        return false;
    }
}

export function isValidDeltaTimeLiteral(literal: string): boolean {
    if (!literal.startsWith("@"))
        return false;

    try {
        parseDuration(literal.slice(1));
        return true;
    } catch {
        return false;
    }
}

export function getSymbolTokenType(symbol: string): TokenType | undefined {
    switch (symbol) {
        case "+": return TokenType.OperatorPlus;
        case "-": return TokenType.OperatorMinus;
        case "*": return TokenType.OperatorMultiply;
        case "/": return TokenType.OperatorDivide;
        case "//": return TokenType.OperatorFloorDivide;
        case "%": return TokenType.OperatorModulo;
        case "++": return TokenType.OperatorConcat;

        case "==": return TokenType.OperatorEqual;
        case "!=": return TokenType.OperatorNotEqual;
        
        case "<": return TokenType.OperatorLessThan;
        case "<=": return TokenType.OperatorLessThanOrEqual;
        case ">": return TokenType.OperatorGreaterThan;
        case ">=": return TokenType.OperatorGreaterThanOrEqual;
        
        case "&": return TokenType.OperatorAnd;
        case "|": return TokenType.OperatorOr;
        case "^": return TokenType.OperatorXor;
        case "!": return TokenType.OperatorNot;
        
        case "=": return TokenType.OperatorAssign;

        case "(": return TokenType.SymbolLeftParen;
        case ")": return TokenType.SymbolRightParen;
        case "[": return TokenType.SymbolLeftBracket;
        case "]": return TokenType.SymbolRightBracket;
        case "{": return TokenType.SymbolLeftBrace;
        case "}": return TokenType.SymbolRightBrace;
        case "{{": return TokenType.SymbolDoubleLeftBrace;
        case "}}": return TokenType.SymbolDoubleRightBrace;
        case ",": return TokenType.SymbolComma;
        case ":": return TokenType.SymbolColon;
        case ";": return TokenType.SymbolSemicolon;
        case ".": return TokenType.SymbolDot;

        default: return undefined;
    }
}

export function refineToken(rawToken: Token<RawTokenType>, context: SourceContext & DiagnosticCollector, rawTokenBuffer: Token<RawTokenType>[]): Token<TokenType> | undefined {
    
    const lexeme = context.getLexemeBy(rawToken);

    let tokenType: TokenType | undefined;
    let isError: boolean | undefined;
    let offset = rawToken.offset;
    let length = rawToken.length;


    switch (rawToken.type) {
        case RawTokenType.Word:
            tokenType = getWordTokenType(lexeme);
            break;
        case RawTokenType.StringLike:
            tokenType = TokenType.StringLiteral;
            isError = !isValidStringLiteral(lexeme);
            if (isError)
                context.error(`Invalid string literal: ${lexeme}`, offset, length);
            break;
        case RawTokenType.IdentifierStringLike:
            tokenType = TokenType.StringIdentifier;
            isError = !isValidIdentifierStringLiteral(lexeme);
            if (isError)
                context.error(`Invalid identifier string literal: ${lexeme}`, offset, length);
            break;
        case RawTokenType.NumberLike:
            tokenType = TokenType.NumberLiteral;
            isError = !isValidNumberLiteral(lexeme);
            if (isError)
                context.error(`Invalid number literal: ${lexeme}`, offset, length);
            break;
        case RawTokenType.DateTimeLike:
            tokenType = TokenType.DateTimeLiteral;
            isError = !isValidDateTimeLiteral(lexeme);
            if (isError)
                context.error(`Invalid date-time literal: ${lexeme}`, offset, length);
            break;
        case RawTokenType.DeltaTimeLike:
            tokenType = TokenType.DeltaTimeLiteral;
            isError = !isValidDeltaTimeLiteral(lexeme);
            if (isError)
                context.error(`Invalid delta-time literal: ${lexeme}`, offset, length);
            break;
        case RawTokenType.AmountLike:
            tokenType = TokenType.AmountLiteral;
            isError = !isValidAmountLiteral(lexeme);
            if (isError)
                context.error(`Invalid amount literal: ${lexeme}`, offset, length);
            break;

        case RawTokenType.SymbolLike:
            for (let lexemeLength = rawToken.length; lexemeLength > 0; lexemeLength--) {
                const symbolLexeme = lexeme.substring(0, lexemeLength);
                const restLexeme = lexeme.substring(lexemeLength);

                const symbolTokenType = getSymbolTokenType(symbolLexeme);

                if (symbolTokenType) {
                    if (restLexeme.length > 0) {
                        rawTokenBuffer.push({
                            type: RawTokenType.SymbolLike,
                            offset: rawToken.offset + lexemeLength,
                            length: restLexeme.length
                        });
                    }

                    tokenType = symbolTokenType;
                    length = lexemeLength;
                    break;
                }
            }

            if (!tokenType) {
                tokenType = TokenType.UnknownSymbol;
                isError = true;
            }

            break;
        case RawTokenType.Trivia:
            throw new Error("[BUG] Trivia tokens should be filtered out before calling refineToken.");

        // errors
        case RawTokenType.InvalidString:
            tokenType = TokenType.StringLiteral;
            isError = true;
            break;
        case RawTokenType.InvalidIdentifierString:
            tokenType = TokenType.StringIdentifier;
            isError = true;
            break;

        default:
            throw new Error(`[BUG] Unexpected raw token type: ${rawToken.type}`);
    }

    return { type: tokenType, offset, length, isError };
}

//

export const tokenMatcher = new TokenMatcher([
    [TokenType.SymbolDoubleLeftBrace, [{ type: TokenType.SymbolLeftBrace, length: 1 }, { type: TokenType.SymbolLeftBrace, length: 1 }]],
    [TokenType.SymbolDoubleRightBrace, [{ type: TokenType.SymbolRightBrace, length: 1 }, { type: TokenType.SymbolRightBrace, length: 1 }]],
]);