import type { Token } from "./core/token";

import type {
    TokenType,
    InfixOperator,
    PrefixOperator,
    Literal,
    Identifier,
} from "./tokens";

export interface NodeBase {
    type: NodeType;
}

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

export interface Program extends NodeBase {
    type: NodeType.Program;
    declarations: Declaration[];
}

export type Declaration = TemplateDeclaration | FunctionDeclaration;

export interface TemplateDeclaration extends NodeBase {
    type: NodeType.TemplateDeclaration;
    name: Token<Identifier>;
    parameters: ParameterDeclaration;
    body: Expression;
} 

export interface FunctionDeclaration extends NodeBase {
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

export interface DoExpression extends NodeBase {
    type: NodeType.DoExpression;
    body: Expression[];
}

export interface IfExpression extends NodeBase {
    type: NodeType.IfExpression;
    condition: Expression;
    consequent?: Expression;
    alternate?: Expression;
}

export interface ForExpression extends NodeBase {
    type: NodeType.ForExpression;
    identifiers: (Expression | undefined)[];
    iterables: Expression[];
    body: Expression;
}

export interface WhileExpression extends NodeBase {
    type: NodeType.WhileExpression;
    condition: Expression;
    body: Expression;
}

export interface ReturnExpression extends NodeBase {
    type: NodeType.ReturnExpression;
    value?: Expression;
}

export interface AssignmentExpression extends NodeBase {
    type: NodeType.AssignmentExpression;
    left: Expression;
    right: Expression;
}

export interface UnaryExpression extends NodeBase {
    type: NodeType.UnaryExpression;
    operator: Token<PrefixOperator>;
    operand: Expression;
}

export interface NAryExpression extends NodeBase {
    type: NodeType.NAryExpression;
    operator: Token<InfixOperator>;
    operands: Expression[];
}

export interface AccessExpression extends NodeBase {
    type: NodeType.AccessExpression;
    target: Expression;
    member: Token<Identifier | TokenType.NumberLiteral>;
}

export interface PackExpression extends NodeBase {
    type: NodeType.PackExpression;
    members: readonly (readonly [Token<TokenType.StringLiteral>, Expression])[];
}

export interface ArrayExpression extends NodeBase {
    type: NodeType.ArrayExpression;
    elements: Expression[];
}

export interface LiteralExpression extends NodeBase {
    type: NodeType.LiteralExpression;
    value: Token<Literal>;
}

export interface IdentifierExpression extends NodeBase {
    type: NodeType.IdentifierExpression;
    value: Token<Identifier>;
}

export interface CallExpression extends NodeBase {
    type: NodeType.CallExpression;
    callee: Expression;
    arguments: CompositeField;
}

export interface NewExpression extends NodeBase {
    type: NodeType.NewExpression;
    callee: Token<Identifier>;
    arguments: CompositeField;
}

export interface ParameterDeclaration extends NodeBase {
    type: NodeType.ParameterDeclaration;
    items: readonly (readonly [Token<Identifier>, Expression])[];
}

export interface CompositeField extends NodeBase {
    type: NodeType.CompositeField;
    members: readonly (readonly [Token<TokenType.StringLiteral>, Expression | CompositeField])[];
}