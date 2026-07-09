
export function singleQuoteToDoubleQuote(literal: string): string {
    return `"${literal.slice(1, -1).replace(/\\.|"/g, match => match === '"' ? '\\"' : match)}"`;
}

export interface PlainDateTime {
    year: number;
    month: number;
    day: number;
    hour: number;
    minute: number;
    second: number;
    nanosecond: number;
}

export interface Duration {
    years: number;
    months: number;
    weeks: number;
    days: number;
    hours: number;
    minutes: number;
    seconds: number;
    nanoseconds: number;
}

export function parseDateTime(str: string): PlainDateTime {
    if (typeof Temporal !== "undefined") {
        const dt = (Temporal as any).PlainDateTime.from(str);
        return {
            year: dt.year,
            month: dt.month,
            day: dt.day,
            hour: dt.hour,
            minute: dt.minute,
            second: dt.second,
            nanosecond: dt.nanosecond
        };
    }
    const regex = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d+))?$/i;
    const match = str.match(regex);
    if (!match) throw new Error("Invalid DateTime format");
    return {
        year: parseInt(match[1]),
        month: parseInt(match[2]),
        day: parseInt(match[3]),
        hour: parseInt(match[4]),
        minute: parseInt(match[5]),
        second: parseInt(match[6]),
        nanosecond: match[7] ? parseInt(match[7].padEnd(9, "0").slice(0, 9)) : 0
    };
}

export function parseDuration(str: string): Duration {
    if (typeof Temporal !== "undefined") {
        const dur = (Temporal as any).Duration.from(str);
        const totalNanoseconds = dur.nanoseconds + dur.microseconds * 1000 + dur.milliseconds * 1000000;
        return {
            years: dur.years,
            months: dur.months,
            weeks: dur.weeks,
            days: dur.days,
            hours: dur.hours,
            minutes: dur.minutes,
            seconds: dur.seconds,
            nanoseconds: totalNanoseconds
        };
    }
    const regex = /^[Pp]?(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?(?:[Tt](?:(\d+)H)?(?:(\d+)M)?(?:(\d+)(?:\.(\d+))?S)?)?$/i;
    const match = str.match(regex);
    if (!match) throw new Error("Invalid Duration format");
    return {
        years: match[1] ? parseInt(match[1]) : 0,
        months: match[2] ? parseInt(match[2]) : 0,
        weeks: match[3] ? parseInt(match[3]) : 0,
        days: match[4] ? parseInt(match[4]) : 0,
        hours: match[5] ? parseInt(match[5]) : 0,
        minutes: match[6] ? parseInt(match[6]) : 0,
        seconds: match[7] ? parseInt(match[7]) : 0,
        nanoseconds: match[8] ? parseInt(match[8].padEnd(9, "0").slice(0, 9)) : 0
    };
}