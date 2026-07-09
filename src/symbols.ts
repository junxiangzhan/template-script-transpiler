import { SymbolTable } from "./core/symbol-table";

export const enum SymbolType {
    BuiltInFunction,
    BuiltInUtility,
    BuiltInConstructor,
    BuiltInSimpleConstructor,
    PreservedIdentifier,
}

export interface SymbolBase {
    type: SymbolType;
}

export type BuiltInSymbol = BuiltInFunction | BuiltInUtility | BuiltInConstructor | BuiltInSimpleConstructor | PreservedIdentifier;

export interface BuiltInFunction extends SymbolBase {
    type: SymbolType.BuiltInFunction;
    insertField: string;
}

export interface BuiltInUtility extends SymbolBase {
    type: SymbolType.BuiltInUtility;
    utilityName: string;
}

export interface BuiltInConstructor extends SymbolBase {
    type: SymbolType.BuiltInConstructor;
    commandName: string;
    fieldName: string;
    insertField?: string;
}

export interface BuiltInSimpleConstructor extends SymbolBase {
    type: SymbolType.BuiltInSimpleConstructor;
    insertField: string;
}

export interface PreservedIdentifier extends SymbolBase {
    type: SymbolType.PreservedIdentifier;
}

export function setDefaultSymbol(symbolTable: SymbolTable<BuiltInSymbol>) {

    // Built-in functions

    symbolTable.setSymbol("clear", {
        type: SymbolType.BuiltInFunction,
        insertField: `"$": "clear"`
    });

    symbolTable.setSymbol("insert", {
        type: SymbolType.BuiltInFunction,
        insertField: `"$": "insert"`
    });

    symbolTable.setSymbol("peek", {
        type: SymbolType.BuiltInFunction,
        insertField: `"$": "peek"`
    });

    symbolTable.setSymbol("pop", {
        type: SymbolType.BuiltInFunction,
        insertField: `"$": "pop"`
    });

    symbolTable.setSymbol("remove", {
        type: SymbolType.BuiltInFunction,
        insertField: `"$": "remove"`
    });

    symbolTable.setSymbol("slice", {
        type: SymbolType.BuiltInFunction,
        insertField: `"$": "slice"`
    });

    symbolTable.setSymbol("form", {
        type: SymbolType.BuiltInFunction,
        insertField: `"$": "form"`
    });

    symbolTable.setSymbol("searchTransaction", {
        type: SymbolType.BuiltInFunction,
        insertField: `"$": "search-transaction"`
    });

    symbolTable.setSymbol("searchAccount", {
        type: SymbolType.BuiltInFunction,
        insertField: `"$": "search-account"`
    });

    symbolTable.setSymbol("searchTag", {
        type: SymbolType.BuiltInFunction,
        insertField: `"$": "search-tag"`
    });

    symbolTable.setSymbol("createTask", {
        type: SymbolType.BuiltInFunction,
        insertField: `"$": "create-task"`
    });

    symbolTable.setSymbol("createEntry", {
        type: SymbolType.BuiltInFunction,
        insertField: `"$": "create-entry"`
    });

    symbolTable.setSymbol("log", {
        type: SymbolType.BuiltInFunction,
        insertField: `"$": "log"`
    });

    // Built-in utilities

    symbolTable.setSymbol("depreciate", {
        type: SymbolType.BuiltInUtility,
        utilityName: "depreciate"
    });

    symbolTable.setSymbol("ratioDepreciate", {
        type: SymbolType.BuiltInUtility,
        utilityName: "ratio-depreciate"
    });

    symbolTable.setSymbol("range", {
        type: SymbolType.BuiltInUtility,
        utilityName: "range"
    });

    symbolTable.setSymbol("suggestAccount", {
        type: SymbolType.BuiltInUtility,
        utilityName: "suggest-account"
    });

    symbolTable.setSymbol("suggestTag", {
        type: SymbolType.BuiltInUtility,
        utilityName: "suggest-tag"
    });

    // Built-in constructors

    symbolTable.setSymbol("Datetime", {
        type: SymbolType.BuiltInConstructor,
        commandName: `"datetime"`,
        fieldName: `"datetime"`
    });
    symbolTable.setSymbol("DateTime", {
        type: SymbolType.BuiltInConstructor,
        commandName: `"datetime"`,
        fieldName: `"datetime"`
    });
    symbolTable.setSymbol("Deltatime", {
        type: SymbolType.BuiltInConstructor,
        commandName: `"deltatime"`,
        fieldName: `"deltatime"`
    });
    symbolTable.setSymbol("DeltaTime", {
        type: SymbolType.BuiltInConstructor,
        commandName: `"deltatime"`,
        fieldName: `"deltatime"`
    });
    symbolTable.setSymbol("Amount", {
        type: SymbolType.BuiltInSimpleConstructor,
        insertField: `"$": "amount"`
    });

    symbolTable.setSymbol("ColBoolean", {
        type: SymbolType.BuiltInConstructor,
        commandName: `"col"`,
        fieldName: `"col"`,
        insertField: `"type": "boolean"`
    });
    symbolTable.setSymbol("ColNumber", {
        type: SymbolType.BuiltInConstructor,
        commandName: `"col"`,
        fieldName: `"col"`,
        insertField: `"type": "number"`
    });
    symbolTable.setSymbol("ColString", {
        type: SymbolType.BuiltInConstructor,
        commandName: `"col"`,
        fieldName: `"col"`,
        insertField: `"type": "string"`
    });
    symbolTable.setSymbol("ColTransaction", {
        type: SymbolType.BuiltInConstructor,
        commandName: `"col"`,
        fieldName: `"col"`,
        insertField: `"type": "transaction"`
    });
    symbolTable.setSymbol("ColAccount", {
        type: SymbolType.BuiltInConstructor,
        commandName: `"col"`,
        fieldName: `"col"`,
        insertField: `"type": "account"`
    });
    symbolTable.setSymbol("ColTag", {
        type: SymbolType.BuiltInConstructor,
        commandName: `"col"`,
        fieldName: `"col"`,
        insertField: `"type": "tag"`
    });
    symbolTable.setSymbol("ColDatetime", {
        type: SymbolType.BuiltInConstructor,
        commandName: `"col"`,
        fieldName: `"col"`,
        insertField: `"type": "datetime"`
    });
    symbolTable.setSymbol("ColDate", {
        type: SymbolType.BuiltInConstructor,
        commandName: `"col"`,
        fieldName: `"col"`,
        insertField: `"type": "date"`
    });
    symbolTable.setSymbol("ColTime", {
        type: SymbolType.BuiltInConstructor,
        commandName: `"col"`,
        fieldName: `"col"`,
        insertField: `"type": "time"`
    });
    symbolTable.setSymbol("ColAmount", {
        type: SymbolType.BuiltInConstructor,
        commandName: `"col"`,
        fieldName: `"col"`,
        insertField: `"type": "amount"`
    });

    symbolTable.setSymbol("ColGroup", {
        type: SymbolType.BuiltInConstructor,
        commandName: `"col-group"`,
        fieldName: `"group"`
    });

    symbolTable.setSymbol("SuggestOption", {
        type: SymbolType.BuiltInConstructor,
        commandName: `"suggest-option"`,
        fieldName: `"option"`
    });

    symbolTable.setSymbol("EntryLine", {
        type: SymbolType.BuiltInConstructor,
        commandName: `"entry-line"`,
        fieldName: `"entry-line"`
    });

    // Preserved identifiers

    symbolTable.setSymbol("", { type: SymbolType.PreservedIdentifier });
}