import { ParsingNodeBase } from "./core/emitter";
import type { Token } from "./core/token";

import type {
    TokenType,
    InfixOperator,
    PrefixOperator,
    Literal,
    Identifier,
} from "./tokens";

export const enum NodeType {
    // root node
    Program,
    TemplateDeclaration,
    FunctionDeclaration,

    // flow control expressions
    DoExpression,
    IfExpression,
    ForExpression,
    WhileExpression,
    ReturnExpression,
    
    // operations
    AssignmentExpression,
    UnaryExpression,
    NAryExpression,

    // access expressions
    AccessExpression,
    
    // literal and identifier expressions
    PackExpression,
    ArrayExpression,
    LiteralExpression,
    IdentifierExpression,

    // function call and object creation expressions
    CallExpression,
    NewExpression,

    // other nodes
    ParameterDeclaration,
    CompositeField
}

//

export type ParsingNode = Program | Declaration | Expression | ParameterDeclaration | CompositeField;

export interface Program extends ParsingNodeBase<NodeType> {
    type: NodeType.Program;
    declarations: Declaration[];
}

export type Declaration = TemplateDeclaration | FunctionDeclaration;

export interface TemplateDeclaration extends ParsingNodeBase<NodeType> {
    type: NodeType.TemplateDeclaration;
    name: Token<Identifier>;
    parameters: ParameterDeclaration;
    body: Expression;
} 

export interface FunctionDeclaration extends ParsingNodeBase<NodeType> {
    type: NodeType.FunctionDeclaration;
    name: Token<Identifier>;
    parameters: ParameterDeclaration;
    body: Expression;
}

export type Expression = 
    | DoExpression
    | IfExpression
    | ForExpression
    | WhileExpression
    | ReturnExpression
    | AssignmentExpression
    | UnaryExpression
    | NAryExpression
    | AccessExpression
    | PackExpression
    | ArrayExpression
    | LiteralExpression
    | IdentifierExpression
    | CallExpression
    | NewExpression;

export interface DoExpression extends ParsingNodeBase<NodeType> {
    type: NodeType.DoExpression;
    body: Expression[];
}

export interface IfExpression extends ParsingNodeBase<NodeType> {
    type: NodeType.IfExpression;
    condition: Expression;
    consequent?: Expression;
    alternate?: Expression;
}

export interface ForExpression extends ParsingNodeBase<NodeType> {
    type: NodeType.ForExpression;
    identifiers: (Expression | undefined)[];
    iterables: Expression[];
    body: Expression;
}

export interface WhileExpression extends ParsingNodeBase<NodeType> {
    type: NodeType.WhileExpression;
    condition: Expression;
    body: Expression;
}

export interface ReturnExpression extends ParsingNodeBase<NodeType> {
    type: NodeType.ReturnExpression;
    value?: Expression;
}

export interface AssignmentExpression extends ParsingNodeBase<NodeType> {
    type: NodeType.AssignmentExpression;
    left: Expression;
    right: Expression;
}

export interface UnaryExpression extends ParsingNodeBase<NodeType> {
    type: NodeType.UnaryExpression;
    operator: Token<PrefixOperator>;
    operand: Expression;
}

export interface NAryExpression extends ParsingNodeBase<NodeType> {
    type: NodeType.NAryExpression;
    operator: Token<InfixOperator>;
    operands: Expression[];
}

export interface AccessExpression extends ParsingNodeBase<NodeType> {
    type: NodeType.AccessExpression;
    target: Expression;
    member: Token<Identifier | TokenType.NumberLiteral>;
}

export interface PackExpression extends ParsingNodeBase<NodeType> {
    type: NodeType.PackExpression;
    members: readonly (readonly [Token<TokenType.StringLiteral>, Expression])[];
}

export interface ArrayExpression extends ParsingNodeBase<NodeType> {
    type: NodeType.ArrayExpression;
    elements: Expression[];
}

export interface LiteralExpression extends ParsingNodeBase<NodeType> {
    type: NodeType.LiteralExpression;
    value: Token<Literal>;
}

export interface IdentifierExpression extends ParsingNodeBase<NodeType> {
    type: NodeType.IdentifierExpression;
    value: Token<Identifier>;
}

export interface CallExpression extends ParsingNodeBase<NodeType> {
    type: NodeType.CallExpression;
    callee: Expression;
    arguments: CompositeField;
}

export interface NewExpression extends ParsingNodeBase<NodeType> {
    type: NodeType.NewExpression;
    callee: Token<Identifier>;
    arguments: CompositeField;
}

export interface ParameterDeclaration extends ParsingNodeBase<NodeType> {
    type: NodeType.ParameterDeclaration;
    items: readonly (readonly [Token<Identifier>, Expression])[];
}

export interface CompositeField extends ParsingNodeBase<NodeType> {
    type: NodeType.CompositeField;
    members: readonly (readonly [Token<TokenType.StringLiteral>, Expression | CompositeField])[];
}