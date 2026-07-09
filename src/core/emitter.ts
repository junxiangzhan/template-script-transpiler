import { CompilerContext } from "./context";


export interface ParsingNodeBase<NodeType> {
    type: NodeType;
}

const enum EmitterStateType {
    Node,
    Action
}

interface EmitterStateBase {
    type: EmitterStateType;
}

interface EmitterStateNode<NodeType, Node extends ParsingNodeBase<NodeType>> extends EmitterStateBase {
    type: EmitterStateType.Node;
    node: Node | undefined;
}

interface EmitterStateAction<NodeType, Node extends ParsingNodeBase<NodeType>> extends EmitterStateBase {
    type: EmitterStateType.Action;
    node: Node;
}

type EmitterState<NodeType, Node extends ParsingNodeBase<NodeType> = ParsingNodeBase<NodeType>> = EmitterStateNode<NodeType, Node> | EmitterStateAction<NodeType, Node>;

type EmitterChildrenResult<NodeType, NodeSequence extends (ParsingNodeBase<NodeType> | undefined)[]> = {
    [K in keyof NodeSequence]: NodeSequence[K] extends ParsingNodeBase<NodeType> ? string : undefined;
};

interface NodeProcessor<SymbolType, NodeType, UniqueNode extends ParsingNodeBase<NodeType> = ParsingNodeBase<NodeType>, NodeSequence extends (ParsingNodeBase<NodeType> | undefined)[] = (ParsingNodeBase<NodeType> | undefined)[]> {
    children(node: UniqueNode): NodeSequence;
    emit(context: CompilerContext<SymbolType>, node: UniqueNode, childrenResults: EmitterChildrenResult<NodeType, NodeSequence>): string;
}

export class Emitter<SymbolType, NodeType, Node extends ParsingNodeBase<NodeType> = ParsingNodeBase<NodeType>> {

    private processors = new Map<NodeType, NodeProcessor<SymbolType, NodeType>>();

    public emit(context: CompilerContext<SymbolType>, startNode: ParsingNodeBase<NodeType>): string {

        const stateStack: EmitterState<NodeType, ParsingNodeBase<NodeType>>[] = [{ type: EmitterStateType.Node, node: startNode }];
        const resultStack: (string | undefined)[][] = [[]];

        let state;
        while (state = stateStack.pop()) {
            const node = state.node;

            if (node === undefined) {
                // undefined only be produced by getChildren()
                // we just need to push undefined to currentResult and continue
                resultStack.at(-1)!.push(undefined);
                continue;
            }

            const processor = this.processors.get(node.type);

            if (!processor)
                throw new Error(`[BUG] No processor registered for node type: ${node.type}`);

            switch (state.type) {
                case EmitterStateType.Node:
                    stateStack.push({ type: EmitterStateType.Action, node });

                    const children = processor.children(node);
                    for (const child of children.reverse())
                        stateStack.push({ type: EmitterStateType.Node, node: child });

                    resultStack.push([]);
                    break;
                case EmitterStateType.Action:
                    const lastResult = resultStack.pop()!;
                    const actionResult = processor.emit(context, node, lastResult as any[]);
                    resultStack.at(-1)!.push(actionResult);
                    break;
            }
        }

        
        const lastResultStack = resultStack.at(0);
        if (lastResultStack === undefined || lastResultStack.length !== 1)
            throw new Error(`[BUG] Emitter finished with unexpected result stack state.`);

        const lastResult = lastResultStack.at(0);
        if (lastResult === undefined)
            throw new Error(`[BUG] Emitter finished with undefined result`);

        return lastResult;
    }

    public process<UniqueTokenType extends NodeType, P extends (ParsingNodeBase<NodeType> | undefined)[]>(nodeType: UniqueTokenType, emitter: NodeProcessor<SymbolType, NodeType, Node & ParsingNodeBase<UniqueTokenType>, P>): void {  
        this.processors.set(nodeType, emitter);
    }
}