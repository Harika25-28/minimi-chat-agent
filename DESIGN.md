# Minimi – Design Document

## 1. Overview

Minimi is a conversational AI agent that combines conversational memory with web search. It can retrieve information from previous conversations, answer date-specific questions, and verify changing information using current web sources.

The main design goal is to provide useful, context-aware answers while keeping the AI agent's tool interface simple.

## 2. Architecture

Minimi uses a backend orchestration architecture.

**Request flow:**

1. The Express API receives a user message.
2. The backend retrieves recent conversation history from SQLite.
3. Date expressions are detected using Luxon and the configured user timezone.
4. Relevant historical messages are retrieved using SQLite FTS5.
5. Gemini determines whether web search is necessary.
6. If required, Gemini invokes the single exposed `web_search` tool.
7. The backend executes the search through Tavily.
8. Search evidence is returned to Gemini to generate the final response.
9. The user message and assistant response are stored in SQLite.

### Tool Design

The AI model has exactly one exposed tool:

- `web_search` – searches the web for current information.

Memory retrieval is handled internally by the backend. It is not exposed as a second model tool.

This separation keeps the model's available actions minimal while allowing the application to manage conversation history independently.

## 3. Technology Choices

| Technology | Reason for selection |
|---|---|
| TypeScript | Type safety and maintainable code |
| Node.js | JavaScript runtime for the backend |
| Express.js | Lightweight HTTP API |
| Google Gemini | AI reasoning and function calling |
| Tavily | Web search API with structured results |
| SQLite | Simple local persistent storage |
| SQLite FTS5 | Efficient full-text memory retrieval |
| Luxon | Timezone-aware date calculations |
| Zod | Request validation |

## 4. Memory Design

Conversation messages are stored in SQLite with their role, content, and creation timestamp.

Two retrieval strategies are used:

- **Recent context:** Retrieves recent messages to maintain conversational continuity.
- **Relevant memory:** Uses SQLite FTS5 to retrieve messages related to the current question.

For date-specific questions, the application calculates the appropriate UTC date range from the user's configured timezone and retrieves messages from that date.

This allows questions such as:

- What did I ask yesterday?
- What did we discuss on November 3?
- What was the first thing I asked last Tuesday?

The application avoids inventing information when the requested historical detail is unavailable.

## 5. Web Search and Information Freshness

Gemini decides when external information is needed and invokes `web_search`.

Tavily retrieves relevant web results, including source URLs and available publication dates.

For information that changes over time, Minimi can compare previously discussed claims with newly retrieved evidence.

For example, Node.js lifecycle verification uses the official Node.js release schedule. The backend retrieves the official schedule and calculates lifecycle status using the current date before providing evidence to Gemini.

This approach reduces reliance on potentially outdated search snippets.

## 6. Alternatives Considered

- **In-memory conversation history:** Rejected because messages would be lost when the application restarts. SQLite provides persistence.
- **Basic SQL keyword matching alone:** Rejected because full-text search offers more flexible retrieval of relevant messages.
- **Exposing memory as another AI tool:** Rejected because internal backend retrieval keeps the model interface limited to exactly one exposed tool.
- **Google Search grounding:** Not selected for this implementation; Tavily provides a separate search API and structured results.
- **A more complex database:** Not necessary for the current single-user prototype. SQLite keeps setup and deployment simple.

## 7. Trade-offs and Limitations

- SQLite is suitable for this prototype but may need replacement or additional concurrency management for a larger multi-user application.
- Full-text retrieval can miss relevant messages when wording differs significantly.
- API availability and response time depend on external Gemini and Tavily services.
- The current implementation uses a fixed recent-message context and retrieval limit.
- Automated test coverage and production monitoring can be expanded.

## 8. Improvements With One More Week

Given another week, I would focus on:

1. Adding automated tests for date detection, historical retrieval, and web-search decisions.
2. Improving memory ranking with semantic retrieval and hybrid search.
3. Adding conversation isolation and user authentication.
4. Improving latency through caching and more efficient context construction.
5. Adding streaming responses and better error handling.
6. Adding deployment, monitoring, and API usage tracking.
7. Evaluating answer quality against a structured set of historical and current-information test cases.

## 9. Key Design Principle

Minimi separates conversational memory from external information retrieval.

SQLite provides persistent historical context, while the single exposed web-search tool provides access to changing external information. Gemini coordinates these capabilities to produce context-aware and evidence-based responses.