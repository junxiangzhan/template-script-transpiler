
export class SymbolTable<T> {

    private symbols: Map<string, T> = new Map();

    getSymbol(name: string): T | undefined {
        return this.symbols.get(name);
    }

    setSymbol(name: string, value: T): void {
        this.symbols.set(name, value);
    }
}