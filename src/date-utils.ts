
import "dotenv/config";
import { DateTime } from "luxon";

const USER_TIME_ZONE =
    process.env.USER_TIME_ZONE || "Asia/Kolkata";

// Convert a local date into UTC boundaries
export function getUtcDateRange(localDate: string) {
    const date = DateTime.fromISO(localDate, {
        zone: USER_TIME_ZONE,
    });

    if (
        !date.isValid ||
        !/^\d{4}-\d{2}-\d{2}$/.test(localDate)
    ) {
        throw new Error("Invalid date. Expected YYYY-MM-DD.");
    }

    const startOfDay = date.startOf("day").toUTC();

    const startOfNextDay = date
        .plus({ days: 1 })
        .startOf("day")
        .toUTC();

    return {
        start: startOfDay.toFormat("yyyy-LL-dd HH:mm:ss"),
        endExclusive: startOfNextDay.toFormat("yyyy-LL-dd HH:mm:ss"),
    };
}

// Resolve relative date expressions
function extractRelativeDate(message: string): string | null {
    const today = DateTime.now().setZone(USER_TIME_ZONE);
    const normalizedMessage = message.toLowerCase();

    if (/\bday before yesterday\b/.test(normalizedMessage)) {
        return today.minus({ days: 2 }).toFormat("yyyy-LL-dd");
    }

    if (/\byesterday\b/.test(normalizedMessage)) {
        return today.minus({ days: 1 }).toFormat("yyyy-LL-dd");
    }

    if (/\btoday\b/.test(normalizedMessage)) {
        return today.toFormat("yyyy-LL-dd");
    }

    if (/\btomorrow\b/.test(normalizedMessage)) {
        return today.plus({ days: 1 }).toFormat("yyyy-LL-dd");
    }

    const weekdays: Record<string, number> = {
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
        sunday: 7,
    };

    const lastWeekdayMatch = normalizedMessage.match(
        /\blast\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/
    );

   if (lastWeekdayMatch?.[1]) {
    const targetWeekday = weekdays[lastWeekdayMatch[1]];

    if (targetWeekday !== undefined) {
        const daysAgo =
            (today.weekday - targetWeekday + 7) % 7 || 7;

        return today
            .minus({ days: daysAgo })
            .toFormat("yyyy-LL-dd");
    }
}

    return null;
}

// Extract a calendar date from a message
export function extractDateFromMessage(message: string): string | null {
    // First check relative date expressions
    const relativeDate = extractRelativeDate(message);

    if (relativeDate) {
        return relativeDate;
    }

    const currentYear = DateTime.now()
        .setZone(USER_TIME_ZONE)
        .year;

    const patterns = [
        {
            regex: /\b\d{4}-\d{2}-\d{2}\b/,
            formats: ["yyyy-MM-dd"],
        },
        {
            regex: /\b\d{1,2}\s+[A-Za-z]+\s+\d{4}\b/,
            formats: ["d MMMM yyyy", "d MMM yyyy"],
        },
        {
            regex: /\b[A-Za-z]+\s+\d{1,2},?\s+\d{4}\b/,
            formats: [
                "MMMM d, yyyy",
                "MMMM d yyyy",
                "MMM d, yyyy",
                "MMM d yyyy",
            ],
        },
        {
            regex: /\b\d{1,2}\s+[A-Za-z]+\b/,
            formats: ["d MMMM", "d MMM"],
        },
        {
            regex: /\b[A-Za-z]+\s+\d{1,2}\b/,
            formats: ["MMMM d", "MMM d"],
        },
    ];

    for (const pattern of patterns) {
        const match = message.match(pattern.regex);

        if (!match) continue;

        for (const format of pattern.formats) {
            const date = DateTime.fromFormat(match[0], format, {
                zone: USER_TIME_ZONE,
                locale: "en",
            });

            const resolvedDate = format.includes("yyyy")
                ? date
                : date.set({ year: currentYear });

            if (resolvedDate.isValid) {
                return resolvedDate.toFormat("yyyy-MM-dd");
            }
        }
    }

    return null;
}
