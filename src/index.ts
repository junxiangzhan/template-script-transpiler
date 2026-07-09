import { CompilerContext } from "./core/context";
import { Scanner } from "./core/scanner";
import { Tokenizer } from "./core/tokenizer";
import { Parser } from "./core/parser";

import { BuiltInSymbol, setDefaultSymbol } from "./symbols";
import { refineToken, skipTokenTypes, tokenMatcher } from "./tokens";
import { DispatchPattern } from "./patterns";
import { program } from "./rules";
import { emitter } from "./emitter";

export function compile(source: string) {
    const compilerContext = new CompilerContext<BuiltInSymbol>(source);
    setDefaultSymbol(compilerContext);
    
    const scanner = new Scanner(() => new DispatchPattern());
    const tokenizer = new Tokenizer(refineToken, skipTokenTypes, scanner);
    const parser = new Parser(tokenizer, tokenMatcher, compilerContext);

    const result = emitter.emit(compilerContext, parser.parse(program.rule));
    return { result, diagnostics: compilerContext.diagnostics };
}