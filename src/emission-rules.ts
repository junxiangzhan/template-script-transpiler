
import type { CompilerContext, SourceContext } from "./core/context";
import type { Token } from "./core/token";
import { Emitter } from "./core/emitter";

import { BuiltInSymbol, SymbolType } from "./symbols";
import { Identifier, TokenType } from "./tokens";
import { NodeType } from "./parsing-tree";
import type { AccessExpression, IdentifierExpression, ParsingNode } from "./parsing-tree";

import { singleQuoteToDoubleQuote, parseDateTime, parseDuration } from "./utils/literals";
import { zip } from "./utils/iterables";

export const emitter = new Emitter<BuiltInSymbol, NodeType, ParsingNode>();

// utilities

function getIdentifierString(context: SourceContext, token: Token<Identifier | TokenType.NumberLiteral>): string {
    if (token.isMissing)
        return "\"__missing_identifier__\"";

    if (token.isError)
        return "\"__error_identifier__\"";

    switch (token.type) {
        case TokenType.Identifier:
            return JSON.stringify(context.getLexemeBy(token));
        case TokenType.StringIdentifier:
            return singleQuoteToDoubleQuote(context.getLexemeBy(token));
        case TokenType.NumberLiteral:
            return JSON.stringify(context.getLexemeBy(token).replace(/_/g, ""));
        default:
            throw new Error(`[BUG] Unexpected token type for identifier: ${token.type}`);
    }
}

function isAccessExpressionWithIdentifierTarget(node: ParsingNode) {
    let currentNode: ParsingNode = node;

    while (currentNode.type === NodeType.AccessExpression)
        currentNode = currentNode.target;

    return currentNode.type === NodeType.IdentifierExpression;
}

function getAccessPathAndTarget(context: SourceContext, accessExpression: AccessExpression | IdentifierExpression): [string, IdentifierExpression] {
    let currentNode: ParsingNode = accessExpression;
    const pathSegments: string[] = [];

    while (currentNode.type === NodeType.AccessExpression) {
        const memberToken = currentNode.member;
        pathSegments.push(getIdentifierString(context, memberToken));
        currentNode = currentNode.target;
    }

    if (currentNode.type !== NodeType.IdentifierExpression)
        throw new Error(`[BUG] Expected identifier expression at the end of access path, but got ${currentNode.type}`);

    pathSegments.push(getIdentifierString(context, currentNode.value));

    pathSegments.reverse();

    return [
        `"${pathSegments.map(seg => seg.slice(1, -1)).join(".")}"`, 
        currentNode
    ];
}

//

emitter.process(NodeType.Program, {
    children(node) {
        return node.declarations;
    },
    emit(_context, _node, childrenResults) {
        return childrenResults.join(", ");
    }
});

emitter.process(NodeType.TemplateDeclaration, {
    children(node) {
        return [node.parameters, node.body] as const;
    },
    emit(context, node, [parametersResult, bodyResult]) {
        const nameStr = context.getLexemeBy(node.name);
        return `{ "code": "${nameStr}", "hidden": false, "script": { "action": [${parametersResult}, ${bodyResult}] } }`;
    }
});

emitter.process(NodeType.FunctionDeclaration, {
    children(node) {
        return [node.parameters, node.body] as const;
    },
    emit(context, node, [parametersResult, bodyResult]) {
        const nameStr = context.getLexemeBy(node.name);
        return `{ "code": "${nameStr}", "hidden": true, "script": { "action": [${parametersResult}, ${bodyResult}] } }`;
    }
});

// flow controls

emitter.process(NodeType.DoExpression, {
    children(node) {
        return node.body;
    },
    emit(_context, _node, childrenResults) {
        return `{ "$": "peek", "target": [${childrenResults.join(", ")}] }`;
    }
});

emitter.process(NodeType.IfExpression, {
    children(node) {
        return [node.condition, node.consequent, node.alternate]
    },
    emit(_context, _node, [conditionResult, consequentResult, alternateResult]) {
        const commandArguments = [
            `"$": "if", "cond": ${conditionResult}`
        ];

        if (consequentResult !== undefined)
            commandArguments.push(`"then": ${consequentResult}`);
        if (alternateResult !== undefined)
            commandArguments.push(`"else": ${alternateResult}`);

        if (commandArguments.length === 1) {
            return "undefined";
        } else {
            return `{ ${commandArguments.join(", ")} }`;
        }
    }
});

emitter.process(NodeType.ForExpression, {
    children(node) {
        return [node.body, ...node.iterables] as const;
    },
    emit(context, node, [bodyResult, ...iterablesResults]) {
        const identifierStrings = node.identifiers
            .map(identifier => {
                if (identifier === undefined)
                    return `"undefined"`;
                if (identifier.type !== NodeType.IdentifierExpression) {
                    context.error(`Expected identifier expression, but got ${identifier.type}`, 0, 0);
                    return `"undefined"`;
                }

                return getIdentifierString(context, identifier.value);
            });

        return `{ "$": "for", "iters": [${iterablesResults.join(", ")}], "as": [${identifierStrings.join(", ")}], "do": ${bodyResult} }`;
    }
});

emitter.process(NodeType.WhileExpression, {
    children(node) {
        return [node.condition, node.body] as const;
    },
    emit(_context, _node, [conditionResult, bodyResult]) {
        return `{ "$": "while", "cond": ${conditionResult}, "do": ${bodyResult} }`;
    }
});

emitter.process(NodeType.ReturnExpression, {
    children(node) {
        return [node.value] as const;
    },
    emit(_context, _node, [valueResult]) {
        return `{ "$": "return", "value": ${valueResult ?? "undefined"} }`;
    }
});

// operations

emitter.process(NodeType.AssignmentExpression, {
    children(node) {
        const expression = node.left;
        if (expression.type === NodeType.IdentifierExpression)
            return [undefined, node.right] as const;

        if (expression.type === NodeType.AccessExpression) {
            if (isAccessExpressionWithIdentifierTarget(expression))
                return [undefined, node.right] as const;

            return [expression.target, node.right] as const;
        }

        return [node.left, node.right] as const;
    },
    emit(context, node, [targetResult, valueResult]) {

        switch (node.left.type) {
            case NodeType.IdentifierExpression:
            case NodeType.AccessExpression:
                if (targetResult === undefined) {
                    return emitIdentifierAssignment(context, node.left, valueResult);
                } else {
                    const propertyString = getIdentifierString(context, (node.left as AccessExpression).member);
                    return `{ "$": "set-prop", "target": ${targetResult}, "prop": ${propertyString}, "value": ${valueResult} }`;
                }
            default:
                context.error(`Invalid left-hand side of assignment: ${node.left.type}`, 0, 0);
                return `{ "$": "peek", "target": ["__invalid_assignment_lhs__", ${valueResult}] }`;
        }
    }
});

function emitIdentifierAssignment(context: CompilerContext<BuiltInSymbol>, node: IdentifierExpression | AccessExpression, valueResult: string): string {
    const [targetString, identifier] = getAccessPathAndTarget(context, node);
    
    const identifierLexeme = getIdentifierString(context, identifier.value);
    const symbol = context.getSymbol(JSON.parse(identifierLexeme) as string);
    switch (symbol?.type) {
        case SymbolType.BuiltInFunction:
            context.error(`Cannot assign to built-in function: ${identifierLexeme}`, 0, 0);
            return `{ "$": "peek", "target": ["__invalid_assignment_lhs__", ${valueResult}] }`;
        case SymbolType.BuiltInUtility:
            context.error(`Cannot assign to built-in utility: ${identifierLexeme}`, 0, 0);
            return `{ "$": "peek", "target": ["__invalid_assignment_lhs__", ${valueResult}] }`;
        case SymbolType.BuiltInConstructor:
        case SymbolType.BuiltInSimpleConstructor:
            context.error(`Cannot assign to built-in constructor: ${identifierLexeme}`, 0, 0);
            return `{ "$": "peek", "target": ["__invalid_assignment_lhs__", ${valueResult}] }`;
        case SymbolType.PreservedIdentifier:
            context.error(`Cannot assign to preserved identifier: ${identifierLexeme}`, 0, 0);
            return `{ "$": "peek", "target": ["__invalid_assignment_lhs__", ${valueResult}] }`;
        default:
            return `{ "$": "set", "target": ${targetString}, "value": ${valueResult} }`;
    }
}

emitter.process(NodeType.UnaryExpression, {
    children(node) {
        return [node.operand] as const;
    },

    emit(_context, node, [operandResult]) {
        if (node.operator.isMissing)
            return `{ "$": "peek", "target": ["__missing__", undefined] }`;
        if (node.operator.isError)
            return `{ "$": "peek", "target": ["__error__", undefined] }`;

        switch (node.operator.type) {
            case TokenType.OperatorMinus:
                return `{ "$": "neg", "operand": ${operandResult} }`;
            case TokenType.OperatorFloor:
                return `{ "$": "int", "operand": ${operandResult} }`;
            case TokenType.OperatorAbsolute:
                return `{ "$": "abs", "operand": ${operandResult} }`;
            case TokenType.OperatorNot:
                return `{ "$": "not", "operand": ${operandResult} }`;
            case TokenType.OperatorReverse:
                return `{ "$": "rev", "operand": ${operandResult} }`;
            default:
                return `{ "$": "peek", "target": ["__unhandled_unary_operator__", ${operandResult}] }`;
        }
    }
});

emitter.process(NodeType.NAryExpression, {
    children(node) {
        return node.operands;
    },

    emit(context, node, childrenResults) {
        const operandsString = `[${childrenResults.join(", ")}]`;

        switch (node.operator.type) {
            case TokenType.OperatorEqual:
                return `{ "$": "eq", "operands": ${operandsString} }`;
            case TokenType.OperatorNotEqual:
                return `{ "$": "ne", "operands": ${operandsString} }`;

            case TokenType.OperatorPlus:
                return `{ "$": "add", "operands": ${operandsString} }`;
            case TokenType.OperatorMinus:
                return `{ "$": "sub", "operands": ${operandsString} }`;
            case TokenType.OperatorMultiply:
                return `{ "$": "mul", "operands": ${operandsString} }`;
            case TokenType.OperatorDivide:
                return `{ "$": "div", "operands": ${operandsString} }`;
            case TokenType.OperatorFloorDivide:
                return `{ "$": "idiv", "operands": ${operandsString} }`;
            case TokenType.OperatorModulo:
                return `{ "$": "mod", "operands": ${operandsString} }`;

            case TokenType.OperatorLessThan:
                return `{ "$": "lt", "operands": ${operandsString} }`;
            case TokenType.OperatorLessThanOrEqual:
                return `{ "$": "le", "operands": ${operandsString} }`;
            case TokenType.OperatorGreaterThan:
                return `{ "$": "gt", "operands": ${operandsString} }`;
            case TokenType.OperatorGreaterThanOrEqual:
                return `{ "$": "ge", "operands": ${operandsString} }`;

            case TokenType.OperatorAnd:
                return `{ "$": "and", "operands": ${operandsString} }`;
            case TokenType.OperatorOr:
                return `{ "$": "or", "operands": ${operandsString} }`;
            case TokenType.OperatorXor:
                return `{ "$": "xor", "operands": ${operandsString} }`;

            case TokenType.OperatorConcat:
                return `{ "$": "cat", "operands": ${operandsString} }`;

            default:
                context.error(`Unhandled operator: ${node.operator.type}`, 0, 0);
                return `{ "$": "peek", "target": ["__unhandled_nary_operator__", ${operandsString}] }`;
        }
    }
});

// access

emitter.process(NodeType.AccessExpression, {
    children(node) {
        if (isAccessExpressionWithIdentifierTarget(node)) {
            return [undefined] as const;
        }

        return [node.target] as const;
    },

    emit(context, node, [targetResult]) {
        if (targetResult !== undefined) {
            return `{ "$": "get-prop", "target": ${targetResult}, "prop": ${getIdentifierString(context, node.member)} }`;
        } 

        const [targetString, identifier] = getAccessPathAndTarget(context, node);

        const identifierLexeme = getIdentifierString(context, identifier.value);
        const symbol = context.getSymbol(JSON.parse(identifierLexeme) as string);
        switch (symbol?.type) {
            case SymbolType.BuiltInFunction:
                context.error(`Cannot access property of built-in function: ${identifierLexeme}`, 0, 0);
                return `{ "$": "peek", "target": ["__invalid_access__", ${targetString}] }`;
            case SymbolType.BuiltInUtility:
                context.error(`Cannot access property of built-in utility: ${identifierLexeme}`, 0, 0);
                return `{ "$": "peek", "target": ["__invalid_access__", ${targetString}] }`;
            case SymbolType.BuiltInConstructor:
            case SymbolType.BuiltInSimpleConstructor:
                context.error(`Cannot access property of built-in constructor: ${identifierLexeme}`, 0, 0);
                return `{ "$": "peek", "target": ["__invalid_access__", ${targetString}] }`;
            case SymbolType.PreservedIdentifier:
            default:
                return `{ "$": "get", "target": ${targetString} }`;
        }
    }
});

// literals

emitter.process(NodeType.LiteralExpression, {
    children() {
        return [];
    },
    emit(context, node) {
        switch (node.value.type) {
            case TokenType.StringLiteral:
                return context.getLexemeBy(node.value);
            case TokenType.NumberLiteral:
                return context.getLexemeBy(node.value).replace(/_/g, "");
            case TokenType.AmountLiteral: {
                const lexeme = context.getLexemeBy(node.value);
                const cleanValue = lexeme.slice(1).replace(/_/g, "");
                return `{ "$": "amount", "amount": ${cleanValue} }`;
            }
            case TokenType.DateTimeLiteral: {
                const lexeme = context.getLexemeBy(node.value);
                const dt = parseDateTime(lexeme.slice(1));
                return `{ "$": "datetime", "datetime": { "year": ${dt.year}, "month": ${dt.month}, "date": ${dt.day}, "hour": ${dt.hour}, "minute": ${dt.minute}, "second": ${dt.second}, "nanosecond": ${dt.nanosecond} } }`;
            }
            case TokenType.DeltaTimeLiteral: {
                const lexeme = context.getLexemeBy(node.value);
                const dur = parseDuration(lexeme.slice(1));
                const parts = [
                    `"years": ${dur.years}`,
                    `"months": ${dur.months}`,
                    `"weeks": ${dur.weeks}`,
                    `"days": ${dur.days}`,
                    `"hours": ${dur.hours}`,
                    `"minutes": ${dur.minutes}`,
                    `"seconds": ${dur.seconds}`,
                    `"nanoseconds": ${dur.nanoseconds}`
                ];
                return `{ "$": "deltatime", "deltatime": { ${parts.join(", ")} } }`;
            }

            case TokenType.KeywordTrue:
                return "true";
            case TokenType.KeywordFalse:
                return "false";
            case TokenType.KeywordNull:
                return "null";
            case TokenType.KeywordUndefined:
                return "undefined";
            default:
                context.error(`Unhandled literal token type: ${node.value.type}`, 0, 0);
                return `{ "$": "peek", "target": ["__unhandled_literal_token_type__", ${context.getLexemeBy(node.value)}] }`;
        }
    }
});

emitter.process(NodeType.PackExpression, {
    children(node) {
        return node.members.map(([_key, value]) => value);
    },
    emit(context, node, childrenResults) {
        const keyLexemes = node.members.map(([key]) => context.getLexemeBy(key));
        const items = [];

        for (const [key, value] of zip(keyLexemes, childrenResults)) {
            items.push(`${key}: ${value}`);
        }

        return `{ "$": "pack", "pack": { ${items.join(", ")} } }`;
    }
});

emitter.process(NodeType.ArrayExpression, {
    children(node) {
        return node.elements;
    },
    emit(_context, _node, childrenResults) {
        return `[${childrenResults.join(", ")}]`;
    }
});

emitter.process(NodeType.IdentifierExpression, {
    children() {
        return [];
    },
    emit(context, node) {
        const lexeme = getIdentifierString(context, node.value);
        const symbol = context.getSymbol(JSON.parse(lexeme) as string);

        switch (symbol?.type) {
            case SymbolType.BuiltInFunction:
                context.error(`Cannot use built-in function as a value: ${lexeme}`, 0, 0);
                return `{ "$": "peek", "target": ["__invalid_identifier__", ${lexeme}] }`;
            case SymbolType.BuiltInUtility:
                context.error(`Cannot use built-in utility as a value: ${lexeme}`, 0, 0);
                return `{ "$": "peek", "target": ["__invalid_identifier__", ${lexeme}] }`;
            case SymbolType.BuiltInConstructor:
            case SymbolType.BuiltInSimpleConstructor:
                context.error(`Cannot use built-in constructor as a value: ${lexeme}`, 0, 0);
                return `{ "$": "peek", "target": ["__invalid_identifier__", ${lexeme}] }`;
            case SymbolType.PreservedIdentifier:
            default:
                return `{ "$": "get", "target": ${getIdentifierString(context, node.value)} }`;
        }
    }
});

emitter.process(NodeType.CallExpression, {
    children(node) {
        return [node.arguments] as const;
    },
    emit(context, node, [argumentsResult]) {
        if (node.callee.type !== NodeType.IdentifierExpression) {
            context.error(`Expected identifier expression as callee, but got ${node.callee.type}`, 0, 0);
            return `{ "$": "peek", "target": ["__invalid_callee__", ${argumentsResult}] }`;
        }

        if (node.callee.value.isMissing) {
            return `{ "$": "peek", "target": ["__missing_callee__", ${argumentsResult}, undefined] }`;
        } else if (node.callee.value.isError) {
            return `{ "$": "peek", "target": ["__error_callee__", ${argumentsResult}, undefined] }`;
        }

        const calleeLexme = getIdentifierString(context, node.callee.value);
        const calleeName = JSON.parse(calleeLexme) as string;

        let symbol = context.getSymbol(calleeName);
        switch (symbol?.type) {
            case SymbolType.BuiltInFunction:
                return `{ ${symbol.insertField}, ${argumentsResult.trim().slice(1, -1).trim()} }`;
            case SymbolType.BuiltInUtility:
                return `{ "$": "util", "util": ${calleeLexme}, "params": ${argumentsResult} }`;
            case SymbolType.BuiltInConstructor:
            case SymbolType.BuiltInSimpleConstructor:
                context.error(`Cannot call built-in constructor as a function: ${calleeLexme}`, 0, 0);
                return `{ "$": "peek", "target": ["__invalid_callee__", ${argumentsResult}, ${calleeLexme}, undefined] }`;
            case SymbolType.PreservedIdentifier:
                context.error(`Cannot call preserved identifier as a function: ${calleeLexme}`, 0, 0);
                return `{ "$": "peek", "target": ["__invalid_callee__", ${argumentsResult}, ${calleeLexme}, undefined] }`;
            default:
                return `{ "$": "run", "template": ${calleeLexme}, "defaults": ${argumentsResult} }`;
        }

    }
});

emitter.process(NodeType.NewExpression, {
    children(node) {
        return [node.arguments] as const;
    },
    emit(context, node, [argumentsResult]) {
        if (node.callee.isMissing)
            return `{ "$": "peek", "target": ["__missing_callee__", ${argumentsResult}, undefined] }`;
        if (node.callee.isError)
            return `{ "$": "peek", "target": ["__error_callee__", ${argumentsResult}, undefined] }`;

        const calleeLexme = getIdentifierString(context, node.callee);
        const calleeName = JSON.parse(calleeLexme) as string;

        let symbol = context.getSymbol(calleeName);
        switch (symbol?.type) {
            case SymbolType.BuiltInConstructor:
                const processedResult = symbol.insertField ? `{ ${symbol.insertField}, ${argumentsResult.slice(2)}` : argumentsResult;
                return `{ "$": ${symbol.commandName}, ${symbol.fieldName}: ${processedResult} }`;
            case SymbolType.BuiltInSimpleConstructor:
                return `{ ${symbol.insertField}, ${argumentsResult.slice(2)}`;
            case SymbolType.BuiltInFunction:
                context.error(`Cannot use built-in function as a constructor: ${calleeLexme}`, 0, 0);
                break;
            case SymbolType.PreservedIdentifier:
                context.error(`Cannot use preserved identifier as a constructor: ${calleeLexme}`, 0, 0);
                break;
            default:
                context.error(`Cannot use non-constructor as a constructor: ${calleeLexme}`, 0, 0);
                break;
        }

        return `{ "$": "peek", "target": ["__invalid_callee__", ${argumentsResult}, ${calleeLexme}, undefined] }`;
    }
});

// others

emitter.process(NodeType.ParameterDeclaration, {
    children(node) {
        return node.items.map(([_identifier, defaultValue]) => defaultValue);
    },
    emit(context, node, childrenResults) {
        const identifierStrings = node.items.map(([identifier]) => getIdentifierString(context, identifier));
        const commands = [];

        for (const [ident, defaultValue] of zip(identifierStrings, childrenResults)) {
            const condition = `{ "$": "is-undefined", "operand": {"$": "get", "target": ${ident} } }`;
            const action = `{ "$": "set", "target": ${ident}, "value": ${defaultValue} }`;
            commands.push(`{ "$": "if", "cond": ${condition}, "then": ${action} }`);
        }

        return `[${commands.join(", ")}]`;
    }
});

emitter.process(NodeType.CompositeField, {
    children(node) {
        return node.members.map(([_, value]) => value);
    },
    emit(context, node, childrenResults) {

        const keyLexemes = node.members.map(([key]) => context.getLexemeBy(key));
        const items = [];

        for (const [key, value] of zip(keyLexemes, childrenResults)) {
            items.push(`${key}: ${value}`);
        }

        return `{ ${items.join(", ")} }`;
    }
});

