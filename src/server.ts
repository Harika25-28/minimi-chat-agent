
import "dotenv/config";

import db from "./database";
import express from "express";
import cors from "cors";
import { z } from "zod";
import { generateResponse } from "./ai";
import { extractDateFromMessage } from "./date-utils";
import { getMessagesForDate } from "./memory";

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Welcome route
app.get("/", (req, res) => {
    res.json({
        message: "Welcome to Minimi Chat Agent API!",
        status: "Server is running successfully",
    });
});

// Health check route
app.get("/health", (req, res) => {
    res.json({
        status: "healthy",
    });
});

// Validate incoming chat messages
const chatMessageSchema = z.object({
    message: z.string().trim().min(1).max(2000),
});


function isHistoricalMemoryQuestion(message: string): boolean {
    const patterns = [
        /\bwhat did i (?:ask|say|tell|mention)\b/i,
        /\bwhat have i (?:asked|said|mentioned)\b/i,
        /\bwhat did we (?:discuss|talk about)\b/i,
        /\bwhat happened in our conversation\b/i,
        /\bwhat was (?:the )?(?:first|last|exact|previous)\b.*\bquestion\b/i,
        /\b(?:our|my|previous|past|earlier|last)\s+(?:conversation|chat|messages?|discussion)\b/i,
        /\b(?:in|during)\s+(?:our|the)\s+(?:conversation|chat|discussion)\b/i,
        /\bconversation history\b/i,
        /\bwhat\s+(?:exact\s+)?(?:time|date)\s+did\s+i\b/i,
        /\bwhen\s+did\s+i\b/i,
        /\bwhat\s+did\s+i\s+(?:have|eat|drink|do|experience)\b/i,
    ];

    return patterns.some(pattern => pattern.test(message));
}


// Chat endpoint
app.post("/chat", async (req, res) => {
    const result = chatMessageSchema.safeParse(req.body);

    if (!result.success) {
        return res.status(400).json({
            error: "Invalid message",
            details: result.error.issues,
        });
    }

    try {
        const userMessage = result.data.message;

        // 1. Retrieve the ten most recent messages
        const previousMessages = db.prepare(`
            SELECT role, content, created_at
            FROM messages
            ORDER BY id DESC
            LIMIT 10
        `).all() as Array<{
            role: string;
            content: string;
            created_at: string;
        }>;

        // Restore chronological order
        previousMessages.reverse();

        // Build recent conversation context
        const conversationContext = previousMessages
            .map(msg => `[${msg.created_at}] ${msg.role}: ${msg.content}`)
            .join("\n");

        // 2. Detect an explicit date in the user's question
        const isHistoricalQuestion = isHistoricalMemoryQuestion(userMessage);

        const requestedDate = isHistoricalQuestion
            ? extractDateFromMessage(userMessage)
            : null;

        console.log("Historical memory question:", isHistoricalQuestion);
        console.log("Detected date:", requestedDate);



        // 3. Retrieve messages from the requested date
        const dateMessages = requestedDate
            ? getMessagesForDate(requestedDate) as Array<{
                id: number;
                role: string;
                content: string;
                created_at: string;
            }>
            : [];

        const dateSpecificContext = dateMessages
            .map(msg => `[${msg.created_at}] ${msg.role}: ${msg.content}`)
            .join("\n");

        // 4. Prepare the user's message for full-text search
        const stopWords = new Set([
            "what", "when", "where", "who", "why", "how",
            "did", "does", "do", "can", "could", "would",
            "should", "tell", "me", "my", "the", "and",
            "for", "from", "about", "was", "were", "are",
            "you", "your", "that", "this", "have", "has",
            "had", "earlier", "previously", "remember"
        ]);

        const searchTerms = userMessage
            .replace(/[^\p{L}\p{N}\s]/gu, " ")
            .split(/\s+/)
            .filter(word => word.length >= 3)
            .filter(word => !stopWords.has(word.toLowerCase()));

        const ftsQuery = searchTerms
            .map(word => `"${word}"`)
            .join(" OR ");

        // 5. Retrieve relevant older memories using FTS5
        const relevantMemories = !requestedDate && ftsQuery
            ? db.prepare(`
                SELECT
                    m.role,
                    m.content,
                    m.created_at,
                    bm25(messages_fts) AS relevance
                FROM messages_fts
                JOIN messages m ON m.id = messages_fts.rowid
                WHERE messages_fts MATCH ?
                ORDER BY relevance ASC
                LIMIT 5
            `).all(ftsQuery) as Array<{
                role: string;
                content: string;
                created_at: string;
                relevance: number;
            }>
            : [];

        const relevantMemoryContext = relevantMemories
            .map(msg => `[${msg.created_at}] ${msg.role}: ${msg.content}`)
            .join("\n");

        // 6. Combine available memory context
        const combinedContext = `
Recent conversation:
${conversationContext || "No recent conversation available."}

Relevant older memories:
${relevantMemoryContext || "No relevant older memories found."}

Requested date:
${requestedDate || "No specific date requested."}

Conversation history for requested date:
${requestedDate
                ? dateSpecificContext || "No messages were found for this date."
                : "No date-specific history requested."}
`;

        // 7. Generate AI response
        const assistantReply = await generateResponse(
            userMessage,
            combinedContext
        );

        // 8. Save both messages
        const insertMessage = db.prepare(`
            INSERT INTO messages (role, content)
            VALUES (?, ?)
        `);

        insertMessage.run("user", userMessage);
        insertMessage.run("assistant", assistantReply.reply);

        // 9. Return response with sources
        res.json({
            success: true,
            receivedMessage: userMessage,
            reply: assistantReply.reply,
            sources: assistantReply.sources,
            requestedDate: requestedDate,
            dateMessagesFound: dateMessages.length,
        });

    } catch (error) {
        console.error("Chat error:", error);

        res.status(500).json({
            success: false,
            error: "Unable to generate a response. Please try again.",
        });
    }
});

// Retrieve conversation history
app.get("/messages", (req, res) => {
    const messages = db.prepare(`
        SELECT id, role, content, created_at
        FROM messages
        ORDER BY id ASC
    `).all();

    res.json({
        success: true,
        totalMessages: messages.length,
        messages: messages,
    });
});

// Start server
app.listen(PORT, () => {
    console.log(`Minimi backend running at http://localhost:${PORT}`);
});
