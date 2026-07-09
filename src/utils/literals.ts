
export function singleQuoteToDoubleQuote(literal: string): string {
    return `"${literal.slice(1, -1).replace(/\\.|"/g, (match) => {
        switch (match) {
            case `"`:
                return `\\"`;
            case `\\'`:
                return `'`;
            default:
                return match;
        }
    })}"`;
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

const regexISO8601TimeStamp = /^(\d{4})-(\d{2})-(\d{2})(?:t(\d{2})(?::(\d{2})(?::(\d{2})(?:\.(\d{1,9}))?)?)?)?$/i;
const regexISO8601Duration = /^p(\d{1,9}y)(\d{1,9}m)(\d{1,9}w)(\d{1,9}d)(t)?(\d{1,9}h)?(\d{1,9}m)?(\d{1,9}s)?$/i;

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

    const match = str.match(regexISO8601TimeStamp);
    if (!match) throw new Error("Invalid DateTime format");
    
    const [fullMatch, yearString, monthString, dayString, hourString = "0", minuteString = "0", secondString = "0", fractionString = "000000000"] = match;

    const year = parseInt(yearString, 10);
    const month = parseInt(monthString, 10);
    const day = parseInt(dayString, 10);
    const hour = parseInt(hourString, 10);
    const minute = parseInt(minuteString, 10);
    const second = parseInt(secondString, 10);
    const nanosecond = parseInt(fractionString.padEnd(9, "0").slice(0, 9), 10);

    switch (month) {
        case 2:
            if (day < 1 || day > 29)
                throw new Error("Invalid day in DateTime format for February");

            if (month == 2 && day == 29) {
                if (year % 400 != 0 && !(year % 4 == 0 && year % 100 != 0))
                    throw new Error("Invalid DateTime format: February 29 is only valid in leap years");
            }
            
            break;

        case 4:
        case 6:
        case 9:
        case 11:
            if (day < 1 || day > 30)
                throw new Error(`Invalid day in DateTime format for month ${month}`);
            break;

        case 1:
        case 3:
        case 5:
        case 7:
        case 8:
        case 10:
        case 12:
            if (day < 1 || day > 31)
                throw new Error(`Invalid day in DateTime format for month ${month}`);
            break;

        default:
            throw new Error(`Invalid month in DateTime format: ${month}`);
    }

    if (
        hour < 0 || hour > 23
        || minute < 0 || minute > 59
        || second < 0 || second > 59
    )
        throw new Error("Invalid time in DateTime format");

    return {
        year,
        month,
        day,
        hour,
        minute,
        second,
        nanosecond
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
    const match = str.match(regexISO8601Duration);
    if (!match) throw new Error("Invalid Duration format");

    const [_fullMatch, yearsString, monthsString, weeksString, daysString, tPart, hoursString, minutesString, secondsString] = match;

    const years = yearsString ? parseInt(yearsString.slice(0, -1), 10) : undefined;
    const months = monthsString ? parseInt(monthsString.slice(0, -1), 10) : undefined;
    const weeks = weeksString ? parseInt(weeksString.slice(0, -1), 10) : undefined;
    const days = daysString ? parseInt(daysString.slice(0, -1), 10) : undefined;
    const hours = hoursString ? parseInt(hoursString.slice(0, -1), 10) : undefined;
    const minutes = minutesString ? parseInt(minutesString.slice(0, -1), 10) : undefined;
    const seconds = secondsString ? parseInt(secondsString.slice(0, -1), 10) : undefined;

    if (tPart == undefined && (hours !== undefined || minutes !== undefined || seconds !== undefined))
        throw new Error("Invalid Duration format: Time part is required");

    if (years === undefined && months === undefined && weeks === undefined && days === undefined && hours === undefined && minutes === undefined && seconds === undefined)
        throw new Error("Invalid Duration format: At least one component is required");



    return {
        years: years ?? 0,
        months: months ?? 0,
        weeks: weeks ?? 0,
        days: days ?? 0,
        hours: hours ?? 0,
        minutes: minutes ?? 0,
        seconds: seconds ?? 0,
        nanoseconds: 0
    };
}