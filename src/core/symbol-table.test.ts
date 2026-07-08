import { describe, it, expect } from "vitest";
import { SymbolTable } from "./symbol-table";

describe("SymbolTable", () => {
    it("manages symbols correctly", () => {
        const table = new SymbolTable<string>();
        expect(table.getSymbol("test")).toBeUndefined();

        table.setSymbol("test", "value");
        expect(table.getSymbol("test")).toBe("value");
    });
});
