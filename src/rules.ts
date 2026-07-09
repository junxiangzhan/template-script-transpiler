import { ParserStateType, ParserPanicError } from "./core/parser";
import type { ParserTokenState, ParserRuleState, ParsingRule, RecoveryCondition, ParserState } from "./core/parser";
import type { Token, PeekableTokenStream } from "./core/token";

import { TokenType } from "./tokens";
import { NodeType } from "./parsing-tree";
import { BuiltInSymbol } from "./symbols";

import {
    infixOperatorTokenTypes,
    prefixOperatorTokenTypes,
    identifierTokenTypes,
    literalTokenTypes,
    expressionFirstTokenTypes
} from "./tokens";

import type {
    Program,
    TemplateDeclaration,
    FunctionDeclaration,
    DoExpression,
    Expression,
    IfExpression,
    ForExpression,
    WhileExpression,
    ReturnExpression,
    PackExpression,
    ArrayExpression,
    LiteralExpression,
    IdentifierExpression,
    CallExpression,
    NewExpression,
    UnaryExpression,
    NAryExpression,
    AccessExpression,
    CompositeField,
    AssignmentExpression
} from "./parsing-tree";

// parser state constructors

export function token<T extends TokenType>(tokenType: T, errorMessage: (butGot: Token<unknown> | undefined) => string): ParserTokenState<T, false> {
    return {
        type: ParserStateType.Token,
        tokenType,
        onMissing: (context, butGot) => {
            context.error(errorMessage(butGot), butGot?.offset, butGot?.length);
            return tokenType; // Return the expected token type to allow parsing to continue
        }
    }
}

export function assertToken<T extends TokenType>(tokenType: T): ParserTokenState<T, false> {
    return {
        type: ParserStateType.Token,
        tokenType,
    }
}

export function optionalToken<T extends TokenType>(tokenType: T): ParserTokenState<T, true> {
    return {
        type: ParserStateType.Token,
        tokenType,
        onMissing: () => undefined
    };
}

export function rule<StateSequence extends readonly ParserState<TokenType>[], ReturnType>(parsingRule: ParsingRule<BuiltInSymbol, TokenType, ReturnType, StateSequence>, recoveryWhen?: RecoveryCondition<TokenType, ReturnType> | { action: undefined }): ParserRuleState<TokenType, ReturnType> {
    return {
        type: ParserStateType.Rule,
        rule: parsingRule,
        recoveryWhen: recoveryWhen?.action && recoveryWhen
    };
}

// parser state utilities

enum ListRuleTolerance {
    noTolerance = 0,
    trailingSeparator = 1,
    emptyElement = 2
}

interface listRuleOptions<R> {
    separators: readonly TokenType[];
    endBoundaries: readonly TokenType[];
    recoveryAction?: RecoveryCondition<TokenType, R>["action"];
    tolerance?: ListRuleTolerance;
}

const emptyItem: ParserRuleState<TokenType, undefined> = rule({
    rule() { return [] as const; },
    action() { return undefined; }
});

export function listRule<StateSequence extends readonly ParserState<TokenType>[], ReturnType>(itemRule: ParsingRule<BuiltInSymbol, TokenType, ReturnType, StateSequence> | ParserRuleState<TokenType, ReturnType>, options: listRuleOptions<ReturnType>): ParserRuleState<TokenType, ReturnType[]> {
    const tolerance = options.tolerance ?? ListRuleTolerance.noTolerance;

    const item = rule(
        "type" in itemRule
            ? itemRule.rule
            : itemRule,
        {
            consume: options.separators,
            peek: options.endBoundaries,
            action: options.recoveryAction
        }
    );

    const restItem = rule({
        rule(parser) {
            const peeked = parser.peekIf(options.separators);
            if (peeked) {
                return [
                    assertToken(peeked.type),
                    recursive(() => afterSeparator),
                ] as const;
            } else {
                return [] as const;
            }
        },

        action(result) {
            if (result.length === 0) {
                return [];
            } else {
                const [_, itemResults] = result;
                return itemResults as ReturnType[];
            }
        }
    });

    const afterSeparator = rule({
        rule(parser) {
            let peeked;

            peeked = parser.peekIf(options.endBoundaries);
            if (peeked && tolerance >= ListRuleTolerance.trailingSeparator) {
                return [] as const;
            }

            peeked = parser.peekIf(options.separators);
            if (peeked && tolerance >= ListRuleTolerance.emptyElement) {
                return [emptyItem, recursive(() => restItem)] as const;
            }

            return [
                item,
                recursive(() => restItem)
            ] as const;
        },

        action(result: readonly any[]): ReturnType[] {
            if (result.length === 0)
                return [];

            return result[0] === undefined
                ? result[1]
                : [result[0], ...(result[1] as ReturnType[])];
        }
    });

    return rule({
        rule(parser) {
            let peeked;

            peeked = parser.peekIf(options.endBoundaries);
            if (peeked) {
                return [] as const;
            }

            peeked = parser.peekIf(options.separators);
            if (peeked && tolerance >= ListRuleTolerance.emptyElement) {
                return [emptyItem, recursive(() => restItem)] as const;
            }

            return [
                item,
                recursive(() => restItem)
            ] as const;
        },
        action(result: readonly any[]): ReturnType[] {
            if (result.length === 0) {
                return [];
            } else {
                const [firstItem, restItems] = result;
                return firstItem !== undefined ? [firstItem, ...restItems] : restItems;
            }
        }
    }, {
        peek: options.endBoundaries,
        action: () => []
    });
}

// recovery action utilities

export function dummyToken<T extends TokenType>(tokenType: T, parser: PeekableTokenStream<TokenType>): Token<T> {
    const butGot = parser.peek();
    return {
        type: tokenType,
        offset: butGot?.offset ?? -1,
        length: butGot?.length ?? 0,
        isMissing: true
    };
}

// type utilities

export function recursive(callback: () => any): any {
    return callback();
}

// program (root)

export const program = rule({
    rule() {
        return [programItems] as const;
    },

    action(result) {
        return {
            type: NodeType.Program,
            declarations: result[0]
        } satisfies Program;
    }
});

const programItems = rule({
    rule(parser) {
        if (parser.peekIf([TokenType.KeywordTemplate])) {
            return [
                templateDeclaration,
                recursive(() => programItems)
            ] as const;
        } else if (parser.peekIf([TokenType.KeywordFunction])) {
            return [
                functionDeclaration,
                recursive(() => programItems)
            ] as const;
        } else {
            return [] as const;
        }
    },

    action(result: readonly any[]) {
        if (result.length === 0) {
            return [];
        } else {
            const [firstDeclaration, restDeclarations] = result;
            return [firstDeclaration, ...restDeclarations as (TemplateDeclaration | FunctionDeclaration)[]] as (TemplateDeclaration | FunctionDeclaration)[];
        }
    }
});

// template and function declaration

const templateDeclaration = rule({
    rule() {
        return [
            assertToken(TokenType.KeywordTemplate),
            identifier,
            token(TokenType.SymbolLeftParen, () => "Expected '(' for template declaration"),
            parameterDeclaration,
            token(TokenType.SymbolRightParen, () => "Expected ')' for template declaration"),
            expression
        ] as const;
    },

    action(result) {
        return {
            type: NodeType.TemplateDeclaration,
            name: result[1],
            parameters: { type: NodeType.ParameterDeclaration, items: result[3] },
            body: result[5]
        } satisfies TemplateDeclaration;
    }
}, {
    peek: [TokenType.KeywordTemplate, TokenType.KeywordFunction],
    action(parser) {
        return {
            type: NodeType.TemplateDeclaration,
            name: dummyToken(TokenType.Identifier, parser),
            parameters: { type: NodeType.ParameterDeclaration, items: [] },
            body: {
                type: NodeType.LiteralExpression,
                value: dummyToken(TokenType.KeywordUndefined, parser)
            }
        } satisfies TemplateDeclaration;
    }
});

const functionDeclaration = rule({
    rule() {
        return [
            assertToken(TokenType.KeywordFunction),
            identifier,
            token(TokenType.SymbolLeftParen, () => "Expected '(' for function declaration"),
            parameterDeclaration,
            token(TokenType.SymbolRightParen, () => "Expected ')' for function declaration"),
            expression
        ] as const;
    },
    action(result) {
        return {
            type: NodeType.FunctionDeclaration,
            name: result[1],
            parameters: { type: NodeType.ParameterDeclaration, items: result[3] },
            body: result[5]
        } satisfies FunctionDeclaration;
    }
}, {
    peek: [TokenType.KeywordTemplate, TokenType.KeywordFunction],
    action(parser) {
        return {
            type: NodeType.FunctionDeclaration,
            name: dummyToken(TokenType.Identifier, parser),
            parameters: { type: NodeType.ParameterDeclaration, items: [] },
            body: {
                type: NodeType.LiteralExpression,
                value: dummyToken(TokenType.KeywordUndefined, parser)
            }
        } satisfies FunctionDeclaration;
    }
});

const parameterDeclaration = listRule({
    rule() {
        return [
            identifier,
            token(TokenType.OperatorAssign, () => "Expected '=' in parameter declaration"),
            expression,
        ] as const;
    },

    action(result) {
        const [keyExpression, , valueExpression] = result;
        return [keyExpression, valueExpression] as const;
    }
}, {
    separators: [TokenType.SymbolComma],
    endBoundaries: [TokenType.SymbolRightParen],
    tolerance: ListRuleTolerance.trailingSeparator
});

// expression

function getPrecedence(tokenType: TokenType): number {
    switch (tokenType) {
        case TokenType.OperatorAssign:
            return 10;
        case TokenType.OperatorOr:
        case TokenType.OperatorXor:
            return 20;
        case TokenType.OperatorAnd:
            return 30;
        case TokenType.OperatorEqual:
        case TokenType.OperatorNotEqual:
            return 40;
        case TokenType.OperatorLessThan:
        case TokenType.OperatorLessThanOrEqual:
        case TokenType.OperatorGreaterThan:
        case TokenType.OperatorGreaterThanOrEqual:
            return 50;
        case TokenType.OperatorPlus:
        case TokenType.OperatorMinus:
        case TokenType.OperatorConcat:
            return 60;
        case TokenType.OperatorMultiply:
        case TokenType.OperatorDivide:
        case TokenType.OperatorFloorDivide:
        case TokenType.OperatorModulo:
            return 70;
        default:
            return 0;
    }
}

function isRightAssociative(tokenType: TokenType): boolean {
    switch (tokenType) {
        case TokenType.OperatorAssign:
            return true;
        default:
            return false;
    }
}

function parseExpression(nodes: (Expression | Token<TokenType>)[]): Expression {
    if (nodes.length === 0) {
        throw new Error("[BUG] Empty nodes in parseShuntingYard");
    }

    const operands: Expression[] = [];
    const operators: Token<TokenType>[] = [];

    function applyOperator() {
        const opToken = operators.pop()!;
        const right = operands.pop()!;
        const left = operands.pop()!;

        if (opToken.type === TokenType.OperatorAssign) {
            const combined: Expression = {
                type: NodeType.AssignmentExpression,
                left,
                right
            } satisfies AssignmentExpression as any;
            operands.push(combined);
        } else {
            // Flatten identical consecutive left-associative operators
            if (
                left.type === NodeType.NAryExpression &&
                (left as NAryExpression).operator.type === opToken.type
            ) {
                (left as NAryExpression).operands.push(right);
                operands.push(left);
            } else {
                const combined: Expression = {
                    type: NodeType.NAryExpression,
                    operator: opToken as any,
                    operands: [left, right]
                } satisfies NAryExpression;
                operands.push(combined);
            }
        }
    }

    for (let i = 0; i < nodes.length; i++) {
        const node = nodes[i];
        if (i % 2 === 0) {
            operands.push(node as Expression);
        } else {
            const opToken = node as Token<TokenType>;
            const opPrecedence = getPrecedence(opToken.type);

            while (operators.length > 0) {
                const topOp = operators[operators.length - 1];
                const topPrecedence = getPrecedence(topOp.type);

                const shouldPop = isRightAssociative(opToken.type)
                    ? topPrecedence > opPrecedence
                    : topPrecedence >= opPrecedence;

                if (shouldPop) {
                    applyOperator();
                } else {
                    break;
                }
            }

            operators.push(opToken);
        }
    }

    while (operators.length > 0) {
        applyOperator();
    }

    if (operands.length !== 1) {
        throw new Error("[BUG] Shunting-Yard finished with invalid operand stack size: " + operands.length);
    }

    return operands[0];
}

const expression = rule({
    rule() {
        return [expressionGather] as const;
    },

    action(result) {
        const flatNodes = result[0];
        return parseExpression(flatNodes);
    }
});

const expressionGather = rule({
    rule() {
        return [
            expressionPrimary,
            expressionWithLeadingOperator
        ] as const;
    },
    action(result) {
        const [primaryResult, leadingOperatorResult] = result;
        return [primaryResult, ...leadingOperatorResult];
    }
});

const expressionWithLeadingOperator = rule({
    rule(parser) {
        let peeked = parser.peekIf(infixOperatorTokenTypes)
        if (peeked) {
            return [
                assertToken(peeked.type),
                expressionPrimary,
                recursive(() => expressionWithLeadingOperator)
            ] as const;
        } else {
            return [] as const;
        }
    },

    action(result) {
        if (result.length === 0)
            return [];

        const [operatorToken, primaryExpression, rest] = result;
        return [operatorToken, primaryExpression, ...(rest as (Token<TokenType> | Expression)[])];
    }
});

const expressionPrimary = rule({
    rule(parser) {
        if (parser.peekIf([TokenType.KeywordDo])) {
            return [recursive(() => doExpression), postfixOperations] as const;
        } else if (parser.peekIf([TokenType.KeywordIf])) {
            return [recursive(() => ifExpression), postfixOperations] as const;
        } else if (parser.peekIf([TokenType.KeywordFor])) {
            return [recursive(() => forExpression), postfixOperations] as const;
        } else if (parser.peekIf([TokenType.KeywordWhile])) {
            return [recursive(() => whileExpression), postfixOperations] as const;
        } else if (parser.peekIf([TokenType.KeywordReturn])) {
            return [recursive(() => returnExpression), postfixOperations] as const;
        } else if (parser.peekIf([TokenType.SymbolDoubleLeftBrace])) {
            return [recursive(() => packLiteral), postfixOperations] as const;
        } else if (parser.peekIf([TokenType.SymbolLeftBracket])) {
            return [recursive(() => arrayLiteral), postfixOperations] as const;
        } else if (parser.peekIf(literalTokenTypes)) {
            return [recursive(() => literal), postfixOperations] as const;
        } else if (parser.peekIf(identifierTokenTypes)) {
            return [recursive(() => identifierExpression), postfixOperations] as const;
        } else if (parser.peekIf(prefixOperatorTokenTypes)) {
            return [recursive(() => unaryOperation), postfixOperations] as const;
        } else if (parser.peekIf([TokenType.KeywordNew])) {
            return [recursive(() => newExpression), postfixOperations] as const;
        }

        const butGot = parser.peek();
        const parserAny = parser as any;
        const errorMessage = `Expected expression but got ${butGot ? butGot.type : "end of input"}`;
        parserAny.context.error(
            errorMessage,
            butGot?.offset ?? parserAny.offset,
            butGot?.length ?? 0
        );
        throw new ParserPanicError(errorMessage);
    },
    action(result: any): Expression {
        const primaryExpression: Expression = result[0];
        const postfixes: (Omit<CallExpression, "callee"> | Omit<AccessExpression, "target">)[] = result[1] ?? [];

        let expression = primaryExpression;
        for (const postfix of postfixes) {
            switch (postfix.type) {
                case NodeType.CallExpression:
                    expression = { ...postfix, callee: expression } satisfies CallExpression;
                    break;
                case NodeType.AccessExpression:
                    expression = { ...postfix, target: expression } satisfies AccessExpression;
                    break;
            }
        }
        return expression;
    }
});

// unary operation

const unaryOperation = rule({
    rule(parser) {
        let peeked = parser.peekIf(prefixOperatorTokenTypes);
        if (peeked) {
            return [
                assertToken(parser.peek()!.type as (typeof prefixOperatorTokenTypes)[number]),
                expressionPrimary
            ] as const;
        }

        throw new Error("[BUG]");
    },
    action(result: any): UnaryExpression {
        const [operatorToken, operandExpression] = result;

        return {
            type: NodeType.UnaryExpression,
            operator: operatorToken,
            operand: operandExpression
        } satisfies UnaryExpression;
    }
});

// postfix operations

const postfixOperations = rule({
    rule(parser) {
        if (parser.peekIf([TokenType.SymbolDot, TokenType.SymbolLeftParen])) {
            return [
                postfixOperationItem,
                recursive(() => postfixOperations)
            ] as const;
        } else {
            return [] as const;
        }
    },
    action(result: readonly any[]) {
        if (result.length === 0) {
            return [];
        } else {
            const [item, rest] = result;
            return [item, ...(rest as (typeof item)[])] as (typeof item)[];
        }
    }
});

const postfixOperationItem = rule({
    rule(parser) {
        if (parser.peekIf([TokenType.SymbolDot])) {
            return [recursive(() => accessPostfix)] as const;
        } else if (parser.peekIf([TokenType.SymbolLeftParen])) {
            return [recursive(() => callPostfix)] as const;
        }
        throw new Error("[BUG]");
    },
    action(result) {
        return result[0] as Omit<CallExpression, "callee"> | Omit<AccessExpression, "target">;
    }
});

// 

const optionalExpression = rule({
    rule(parser) {
        if (parser.peekIf(expressionFirstTokenTypes)) {
            return [expression] as const;
        } else {
            return [] as const;
        }
    },

    action(result) {
        if (result.length === 0) {
            return undefined;
        } else {
            return result[0];
        }
    }
});

// do expression

const doExpression = rule({
    rule() {
        return [
            assertToken(TokenType.KeywordDo),
            token(TokenType.SymbolLeftBrace, () => "Expected '{' for do expression"),
            doExpressionBody,
            token(TokenType.SymbolRightBrace, () => "Expected '}' for do expression")
        ] as const;
    },
    action(result) {
        return {
            type: NodeType.DoExpression,
            body: result[2]
        } satisfies DoExpression;
    }
}, {
    peek: [TokenType.SymbolSemicolon, TokenType.SymbolRightBrace],
    action() {
        return {
            type: NodeType.DoExpression,
            body: []
        } satisfies DoExpression;
    }
});

const doExpressionBody: ParserRuleState<TokenType, Expression[]> = rule({
    rule(parser) {
        if (parser.peekIf([TokenType.SymbolRightBrace])) {
            return [] as const;
        } else if (parser.peekIf([TokenType.SymbolSemicolon])) {
            return [
                assertToken(TokenType.SymbolSemicolon),
                recursive(() => doExpressionBody)
            ] as const;
        } else {
            return [
                expression,
                token(TokenType.SymbolSemicolon, () => "Expected ';' after expression in do expression"),
                recursive(() => doExpressionBody)
            ] as const;
        }
    },
    action(result: readonly any[]) {
        if (result.length === 0) {
            return [];
        } else if (result.length === 2) {
            const [, rest] = result as [Token<TokenType.SymbolSemicolon>, Expression[]];
            return rest;
        } else {
            const [expression, , rest] = result as [Expression, Token<TokenType.SymbolSemicolon>, Expression[]];
            return [expression, ...rest];
        }
    }
}, {
    consume: [TokenType.SymbolSemicolon],
    peek: [TokenType.SymbolRightBrace],
    action() {
        return [];
    }
});

// if expression

const ifExpression = rule({
    rule() {
        return [
            ifExpressionWithoutElse,
            ifExpressionElse
        ] as const;
    },
    action(result) {
        const [resultWithoutElse, resultElse] = result;

        const node: IfExpression = {
            type: NodeType.IfExpression,
            condition: resultWithoutElse.condition,
            consequent: resultWithoutElse.branch,
            alternate: resultElse?.branch
        };

        if (resultWithoutElse.isNegated) {
            [node.consequent, node.alternate] = [node.alternate, node.consequent];
        }

        return node;
    }
}, {
    peek: [TokenType.SymbolSemicolon, TokenType.SymbolRightBrace, TokenType.SymbolComma],
    action(parser) {
        return {
            type: NodeType.IfExpression,
            condition: {
                type: NodeType.LiteralExpression,
                value: dummyToken(TokenType.KeywordUndefined, parser)
            }
        } satisfies IfExpression;
    }
});

const ifExpressionWithoutElse = rule({
    rule() {
        return [
            assertToken(TokenType.KeywordIf),
            optionalToken(TokenType.OperatorNot),
            token(TokenType.SymbolLeftParen, () => "Expected '(' for if expression"),
            expression,
            token(TokenType.SymbolRightParen, () => "Expected ')' for if expression"),
            expression
        ] as const;
    },
    action(result) {
        return {
            condition: result[3],
            branch: result[5],
            isNegated: result[1] !== undefined
        }
    }
});

const ifExpressionElse = rule({
    rule(parser) {
        if (parser.peekIf([TokenType.KeywordElse])) {
            return [
                assertToken(TokenType.KeywordElse),
                expression
            ] as const;
        } else {
            return [] as const;
        }

    },
    action(result) {
        return result.length ? {
            branch: result[1]
        } : undefined;
    }
});

// for expression

const forExpression = rule({
    rule() {
        return [
            assertToken(TokenType.KeywordFor),
            token(TokenType.SymbolLeftParen, () => "Expected '(' for for expression"),
            forExpressionCondition,
            token(TokenType.SymbolRightParen, () => "Expected ')' for for expression"),
            expression
        ] as const;
    },
    action(result) {

        const identifiers: (Expression | undefined)[] = [];
        const iterables: Expression[] = [];

        for (const item of result[2]) {
            identifiers.push(item.identifier);
            iterables.push(item.iterable);
        }

        return {
            type: NodeType.ForExpression,
            identifiers,
            iterables,
            body: result[4]
        } satisfies ForExpression;
    }
}, {
    peek: [TokenType.SymbolSemicolon, TokenType.SymbolRightBrace, TokenType.SymbolComma],
    action(parser) {
        return {
            type: NodeType.ForExpression,
            identifiers: [],
            iterables: [],
            body: {
                type: NodeType.LiteralExpression,
                value: dummyToken(TokenType.KeywordUndefined, parser)
            }
        } satisfies ForExpression;
    }
});

const forExpressionCondition = listRule({
    rule() {
        return [
            expression,
            forExpressionItemRest
        ] as const;
    },
    action(result) {
        const [expr, rest] = result;

        if (rest === undefined) {
            return {
                identifier: undefined,
                iterable: expr
            };
        } else {
            return {
                identifier: expr,
                iterable: rest
            };
        }
    }
}, {
    separators: [TokenType.SymbolComma],
    endBoundaries: [TokenType.SymbolRightParen],
    tolerance: ListRuleTolerance.noTolerance
});

const forExpressionItemRest = rule({
    rule(parser) {
        if (parser.peekIf([TokenType.KeywordIn])) {
            return [
                assertToken(TokenType.KeywordIn),
                expression
            ] as const;
        } else {
            return [] as const;
        }
    },
    action(result) {
        if (result.length === 0) {
            return undefined;
        } else {
            return result[1] as Expression;
        }
    }
});

//

const whileExpression = rule({
    rule() {
        return [
            assertToken(TokenType.KeywordWhile),
            optionalToken(TokenType.OperatorNot),
            token(TokenType.SymbolLeftParen, () => "Expected '(' for while expression"),
            expression,
            token(TokenType.SymbolRightParen, () => "Expected ')' for while expression"),
            expression
        ] as const;
    },

    action(result) {
        if (result[1] === undefined) {
            return {
                type: NodeType.WhileExpression,
                condition: result[3],
                body: result[5]
            } satisfies WhileExpression;
        } else {
            return {
                type: NodeType.WhileExpression,
                condition: {
                    type: NodeType.UnaryExpression,
                    operator: result[1],
                    operand: result[3]
                } satisfies UnaryExpression,
                body: result[5]
            } satisfies WhileExpression;
        }
    }
}, {
    peek: [TokenType.SymbolSemicolon, TokenType.SymbolRightBrace, TokenType.SymbolComma],
    action(parser) {
        const dummyExpr: Expression = {
            type: NodeType.LiteralExpression,
            value: dummyToken(TokenType.KeywordUndefined, parser)
        };
        return {
            type: NodeType.WhileExpression,
            condition: dummyExpr,
            body: dummyExpr
        } satisfies WhileExpression;
    }
});

//

const returnExpression = rule({
    rule() {
        return [
            assertToken(TokenType.KeywordReturn),
            optionalExpression
        ] as const;
    },
    action(result) {
        return {
            type: NodeType.ReturnExpression,
            value: result[1]
        } satisfies ReturnExpression;
    }
}, {
    peek: [TokenType.SymbolSemicolon, TokenType.SymbolRightBrace, TokenType.SymbolComma],
    action() {
        return {
            type: NodeType.ReturnExpression
        } satisfies ReturnExpression;
    }
});

// pack literal

const packLiteral = rule({
    rule() {
        return [
            assertToken(TokenType.SymbolDoubleLeftBrace),
            packLiteralItems,
            assertToken(TokenType.SymbolDoubleRightBrace)
        ] as const;
    },
    action(result) {
        return {
            type: NodeType.PackExpression,
            members: result[1]
        } satisfies PackExpression;
    }
}, {
    peek: [TokenType.SymbolSemicolon, TokenType.SymbolRightBrace, TokenType.SymbolComma, TokenType.SymbolRightParen, TokenType.SymbolRightBracket, TokenType.SymbolDoubleRightBrace],
    action() {
        return {
            type: NodeType.PackExpression,
            members: []
        } satisfies PackExpression;
    }
});

const packLiteralItems = listRule({
    rule() {
        return [
            token(TokenType.StringLiteral, () => "Expected a string literal for key in pack literal"),
            token(TokenType.SymbolColon, () => "Expected ':' in pack literal"),
            expression
        ] as const;
    },
    action(result) {
        const [keyExpression, , valueExpression] = result;
        return [keyExpression, valueExpression] as [Token<TokenType.StringLiteral>, Expression];
    }
}, {
    separators: [TokenType.SymbolComma],
    endBoundaries: [TokenType.SymbolDoubleRightBrace],
    tolerance: ListRuleTolerance.trailingSeparator
});

// array literal

const arrayLiteral = rule({
    rule() {
        return [
            assertToken(TokenType.SymbolLeftBracket),
            arrayLiteralItems,
            assertToken(TokenType.SymbolRightBracket)
        ] as const;
    },
    action(result) {
        return {
            type: NodeType.ArrayExpression,
            elements: result[1]
        } satisfies ArrayExpression;
    }
}, {
    peek: [TokenType.SymbolSemicolon, TokenType.SymbolRightBrace, TokenType.SymbolComma, TokenType.SymbolRightParen, TokenType.SymbolRightBracket, TokenType.SymbolDoubleRightBrace],
    action() {
        return {
            type: NodeType.ArrayExpression,
            elements: []
        } satisfies ArrayExpression;
    }
});

const arrayLiteralItems = listRule({
    rule() {
        return [expression] as const;
    },
    action(result) {
        return result[0];
    }
}, {
    separators: [TokenType.SymbolComma],
    endBoundaries: [TokenType.SymbolRightBracket],
    tolerance: ListRuleTolerance.trailingSeparator
});

// literal

const literal = rule({
    rule(parser) {
        if (parser.peekIf(literalTokenTypes)) {
            return [assertToken(parser.peek()!.type as (typeof literalTokenTypes)[number])] as const;
        } else {
            throw new Error("[BUG]");
        }
    },

    action(result) {
        return {
            type: NodeType.LiteralExpression,
            value: result[0]
        } satisfies LiteralExpression;
    }
});

// identifier

const identifier = rule({
    rule(parser) {
        if (parser.peekIf([TokenType.StringIdentifier])) {
            return [assertToken(TokenType.StringIdentifier)] as const;
        } else {
            return [token(TokenType.Identifier, () => "Expected an identifier")] as const;
        }
    },

    action(result) {
        return result[0];
    }
});

const identifierExpression = rule({
    rule() {
        return [identifier] as const;
    },

    action(result) {
        return {
            type: NodeType.IdentifierExpression,
            value: result[0]
        } satisfies IdentifierExpression;
    }
});


// member access

const accessMember = rule({
    rule(parser) {
        if (parser.peekIf([TokenType.StringIdentifier])) {
            return [assertToken(TokenType.StringIdentifier)] as const;
        } else if (parser.peekIf([TokenType.NumberLiteral])) {
            return [assertToken(TokenType.NumberLiteral)] as const;
        } else {
            return [token(TokenType.Identifier, () => "Expected an identifier or a number literal")] as const;
        }
    },
    action(result) {
        return result[0];
    }
});

const accessPostfix = rule({
    rule() {
        return [
            assertToken(TokenType.SymbolDot),
            accessMember
        ] as const;
    },
    action(result) {
        return {
            type: NodeType.AccessExpression,
            member: result[1]
        } satisfies Omit<AccessExpression, "target">;
    }
});

// new expression

const newExpression = rule({
    rule() {
        return [
            assertToken(TokenType.KeywordNew),
            identifier,
            token(TokenType.SymbolLeftBrace, () => "Expected '{' for object creation"),
            fieldItems,
            token(TokenType.SymbolRightBrace, () => "Expected '}' for object creation")
        ] as const;
    },
    action(result): NewExpression {
        return {
            type: NodeType.NewExpression,
            callee: result[1],
            arguments: {
                type: NodeType.CompositeField,
                members: result[3]
            }
        } satisfies NewExpression;
    }
}, {
    peek: [TokenType.SymbolSemicolon, TokenType.SymbolRightBrace, TokenType.SymbolComma, TokenType.SymbolRightParen, TokenType.SymbolRightBracket, TokenType.SymbolDoubleRightBrace],
    action(parser) {
        return {
            type: NodeType.NewExpression,
            callee: dummyToken(TokenType.Identifier, parser),
            arguments: { type: NodeType.CompositeField, members: [] }
        } satisfies NewExpression;
    }
});

// function call

const callPostfix = rule({
    rule() {
        return [argumentField] as const;
    },
    action(result): Omit<CallExpression, "callee"> {
        return {
            type: NodeType.CallExpression,
            arguments: result[0]
        } satisfies Omit<CallExpression, "callee">;
    }
});

// composite field related

const argumentField = rule({
    rule() {
        return [
            token(TokenType.SymbolLeftParen, () => "Expected '(' for argument field"),
            fieldItems,
            token(TokenType.SymbolRightParen, () => "Expected ')' for argument field")
        ] as const;
    },
    action(result) {
        return {
            type: NodeType.CompositeField,
            members: result[1]
        } satisfies CompositeField;
    }
});

const fieldItems = listRule({
    rule() {
        return [
            token(TokenType.StringLiteral, () => "Expected string literal for field key"),
            token(TokenType.SymbolColon, () => "Expected ':' in field item"),
            fieldItemValue
        ] as const;
    },
    action(result) {
        return [
            result[0], // key
            result[2]  // value
        ] as [Token<TokenType.StringLiteral>, Expression | CompositeField];
    }
}, {
    separators: [TokenType.SymbolComma],
    endBoundaries: [TokenType.SymbolRightParen, TokenType.SymbolRightBrace],
    tolerance: ListRuleTolerance.trailingSeparator
});

const fieldItemValue = rule({
    rule(parser) {
        if (parser.peekIf([TokenType.SymbolLeftBrace])) {
            return [
                assertToken(TokenType.SymbolLeftBrace),
                recursive(() => fieldItems),
                assertToken(TokenType.SymbolRightBrace)
            ] as const;
        } else {
            return [expression] as const;
        }
    },
    action(result: readonly any[]): Expression | CompositeField {
        if (result.length === 1) {
            return result[0];
        } else {
            return {
                type: NodeType.CompositeField,
                members: result[1] as [Token<TokenType.StringLiteral>, Expression | CompositeField][]
            } satisfies CompositeField;
        }
    }
});
