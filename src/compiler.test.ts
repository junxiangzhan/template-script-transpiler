import { describe, it, expect } from "vitest";
import { compile } from "./index";

describe("Template Script Transpiler", () => {
    it("compiles simple template and function declarations", () => {
        const source = `
            template testTemplate(
                a = 10,
                b = "hello",
            ) do {
                log("value": a);
            }
        `;
        const { result, diagnostics } = compile(source);
        expect(diagnostics).toEqual([]);
        const parsed = JSON.parse(result);
        expect(parsed).toEqual({
            code: "testTemplate",
            hidden: false,
            script: {
                action: [
                    [
                        { "$": "if", "cond": { "$": "is-undefined", "operand": { "$": "get", "target": "a" } }, "then": { "$": "set", "target": "a", "value": 10 } },
                        { "$": "if", "cond": { "$": "is-undefined", "operand": { "$": "get", "target": "b" } }, "then": { "$": "set", "target": "b", "value": "hello" } }
                    ],
                    {
                        "$": "peek",
                        "target": [
                            { "$": "log", "value": { "$": "get", "target": "a" } }
                        ]
                    }
                ]
            }
        });
    });

    it("supports underscore in numbers and amount literals", () => {
        const source = `
            template testNumber(
            ) do {
                x = 10_000.25;
                y = $1_000_000;
            }
        `;
        const { result, diagnostics } = compile(source);
        expect(diagnostics).toEqual([]);
        const parsed = JSON.parse(result);
        expect(parsed.script.action[1]).toEqual({
            "$": "peek",
            "target": [
                { "$": "set", "target": "x", "value": 10000.25 },
                { "$": "set", "target": "y", "value": { "$": "amount", "amount": 1000000 } }
            ]
        });
    });

    it("parses and emits datetime and deltatime literals", () => {
        const source = `
            template testTime(
            ) do {
                dt = @2000-01-01T00:00:00.0000;
                dur = @p5dt2s;
            }
        `;
        const { result, diagnostics } = compile(source);
        expect(diagnostics).toEqual([]);
        const parsed = JSON.parse(result);
        expect(parsed.script.action[1]).toEqual({
            "$": "peek",
            "target": [
                {
                    "$": "set",
                    "target": "dt",
                    "value": {
                        "$": "datetime",
                        "datetime": {
                            "year": 2000,
                            "month": 1,
                            "date": 1,
                            "hour": 0,
                            "minute": 0,
                            "second": 0,
                            "nanosecond": 0
                        }
                    }
                },
                {
                    "$": "set",
                    "target": "dur",
                    "value": {
                        "$": "deltatime",
                        "deltatime": {
                            "years": 0,
                            "months": 0,
                            "weeks": 0,
                            "days": 5,
                            "hours": 0,
                            "minutes": 0,
                            "seconds": 2,
                            "nanoseconds": 0
                        }
                    }
                }
            ]
        });
    });

    it("compiles new object creation expressions with curly braces", () => {
        const source = `
            template testNew(
            ) do {
                a = new Amount { "value": 100 };
                c = new ColBoolean { "target": "has been sold" };
                n = new ColNumber {
                    "target": "count",
                    "validation": { "min": 0 }
                };
            }
        `;
        const { result, diagnostics } = compile(source);
        expect(diagnostics).toEqual([]);
        const parsed = JSON.parse(result);
        expect(parsed.script.action[1]).toEqual({
            "$": "peek",
            "target": [
                {
                    "$": "set",
                    "target": "a",
                    "value": { "$": "amount", "value": 100 }
                },
                {
                    "$": "set",
                    "target": "c",
                    "value": { "$": "col", "col": { "type": "boolean", "target": "has been sold" } }
                },
                {
                    "$": "set",
                    "target": "n",
                    "value": {
                        "$": "col",
                        "col": {
                            "type": "number",
                            "target": "count",
                            "validation": { "min": 0 }
                        }
                    }
                }
            ]
        });
    });

    it("compiles built-in function calls like searchAccount and searchTag correctly", () => {
        const source = `
            template testFunctions(
            ) do {
                a = searchAccount("code": "1111");
                t = searchTag("code": "default");
                log("value": a);
            }
        `;
        const { result, diagnostics } = compile(source);
        expect(diagnostics).toEqual([]);
        const parsed = JSON.parse(result);
        expect(parsed.script.action[1]).toEqual({
            "$": "peek",
            "target": [
                {
                    "$": "set",
                    "target": "a",
                    "value": { "$": "search-account", "code": "1111" }
                },
                {
                    "$": "set",
                    "target": "t",
                    "value": { "$": "search-tag", "code": "default" }
                },
                {
                    "$": "log",
                    "value": { "$": "get", "target": "a" }
                }
            ]
        });
    });

    it("compiles binary operations and operators", () => {
        const source = `
            template testOps(
            ) do {
                v1 = 1 + 2 * 3;
                v2 = a < b < c;
                v3 = x & y | z;
            }
        `;
        const { result, diagnostics } = compile(source);
        expect(diagnostics).toEqual([]);
        const parsed = JSON.parse(result);
        expect(parsed.script.action[1]).toEqual({
            "$": "peek",
            "target": [
                {
                    "$": "set",
                    "target": "v1",
                    "value": {
                        "$": "add",
                        "operands": [
                            1,
                            { "$": "mul", "operands": [2, 3] }
                        ]
                    }
                },
                {
                    "$": "set",
                    "target": "v2",
                    "value": {
                        "$": "lt",
                        "operands": [
                            { "$": "get", "target": "a" },
                            { "$": "get", "target": "b" },
                            { "$": "get", "target": "c" }
                        ]
                    }
                },
                {
                    "$": "set",
                    "target": "v3",
                    "value": {
                        "$": "or",
                        "operands": [
                            {
                                "$": "and",
                                "operands": [
                                    { "$": "get", "target": "x" },
                                    { "$": "get", "target": "y" }
                                ]
                            },
                            { "$": "get", "target": "z" }
                        ]
                    }
                }
            ]
        });
    });

    it("compiles member access with numeric literals like array.0 and chained access", () => {
        const source = `
            template testArrayAccess(
            ) do {
                a = array.0;
                b = array.0.value;
                c = foo().0;
            }
        `;
        const { result, diagnostics } = compile(source);
        expect(diagnostics).toEqual([]);
        const parsed = JSON.parse(result);
        expect(parsed.script.action[1]).toEqual({
            "$": "peek",
            "target": [
                {
                    "$": "set",
                    "target": "a",
                    "value": { "$": "get", "target": "array.0" }
                },
                {
                    "$": "set",
                    "target": "b",
                    "value": { "$": "get", "target": "array.0.value" }
                },
                {
                    "$": "set",
                    "target": "c",
                    "value": { "$": "get-prop", "target": { "$": "run", "template": "foo", "defaults": {} }, "prop": "0" }
                }
            ]
        });
    });
});
