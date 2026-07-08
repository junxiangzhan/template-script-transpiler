import { CompilerContext } from "./core/context";
import { Tokenizer } from "./core/tokenizer";
import { Parser } from "./core/parser";

import { refineToken, skipTokenTypes, tokenMatcher } from "./tokens";
import { DispatchPattern } from "./patterns";
import { BuiltInSymbol, setDefaultSymbol } from "./symbols";
import { emit } from "./emitter";
import { program } from "./rules";

export function compile(source: string) {
    const compilerContext = new CompilerContext<BuiltInSymbol>(source);
    setDefaultSymbol(compilerContext);
    
    const tokenizer = new Tokenizer(refineToken, skipTokenTypes, () => new DispatchPattern());
    const parser = new Parser(tokenizer, tokenMatcher, compilerContext);
    
    const result = emit(compilerContext, parser.parse(program.rule));
    return { result, diagnostics: compilerContext.diagnostics };
}