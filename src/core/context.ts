import { type Peekable, PeekableString } from "../utils/peekable";
import { SymbolTable } from "./symbol-table";

export interface Diagnostic {
    type: "error" | "warning";
    message: string;
    offset: number;
    length: number;
}

export interface DiagnosticCollector {
    warn(message: string, offset?: number, length?: number): void;
    error(message: string, offset?: number, length?: number): void;
}

export interface SourceContext {
    source: string;
    getCharStream(startOffset?: number): Peekable<string>;
    getLexeme(offset: number, length: number): string;
    getLexemeBy(token: { offset: number; length: number }): string;
}

export class CompilerContext<T> extends SymbolTable<T> implements DiagnosticCollector, SourceContext {
    public source: string;
    public diagnostics: Diagnostic[] = [];

    constructor(source: string) {
        super();
        this.source = source;
    }

    public getCharStream(startOffset: number = 0): Peekable<string> {
        return new PeekableString(this.source, startOffset);
    }

    public getLexeme(offset: number, length: number): string {
        return this.source.substring(offset, offset + length);
    }

    public getLexemeBy(token: { offset: number; length: number }): string {
        return this.getLexeme(token.offset, token.length);
    }

    public warn(message: string, offset?: number, length?: number): void {
        this.diagnostics.push({
            type: "warning", message, 
            offset: offset ?? this.source.length,
            length: length ?? 0
        });
    }

    public error(message: string, offset?: number, length?: number): void {
        this.diagnostics.push({
            type: "error", message, 
            offset: offset ?? this.source.length,
            length: length ?? 0
        });
    }
}