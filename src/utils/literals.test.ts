import { describe, it, expect } from "vitest";
import { singleQuoteToDoubleQuote, parseDateTime, parseDuration } from "./literals";

describe("literals utility", () => {
    it("converts single quoted strings to double quotes escaping properly", () => {
        expect(singleQuoteToDoubleQuote("'hello'")).toBe('"hello"');
        expect(singleQuoteToDoubleQuote("'he\\'llo'")).toBe('"he\'llo"');
    });

    it("parses valid and invalid ISO DateTimes", () => {
        const parsed = parseDateTime("2000-01-01T12:34:56.123");
        expect(parsed).toEqual({
            year: 2000,
            month: 1,
            day: 1,
            hour: 12,
            minute: 34,
            second: 56,
            nanosecond: 123000000
        });

        expect(() => parseDateTime("invalid")).toThrow();
    });

    it("parses valid and invalid ISO Durations", () => {
        const parsed = parseDuration("p5dt2s");
        expect(parsed).toEqual({
            years: 0,
            months: 0,
            weeks: 0,
            days: 5,
            hours: 0,
            minutes: 0,
            seconds: 2,
            nanoseconds: 0
        });

        expect(() => parseDuration("invalid")).toThrow();
    });
});
