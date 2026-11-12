
import db from "./database";
import { getUtcDateRange } from "./date-utils";

export function getMessagesForDate(localDate: string) {
    const { start, endExclusive } = getUtcDateRange(localDate);

    const messages = db.prepare(`
        SELECT id, role, content, created_at
        FROM messages
        WHERE created_at >= ?
          AND created_at < ?
        ORDER BY id ASC
    `).all(start, endExclusive);

    return messages;
}
