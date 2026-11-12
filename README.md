# Minimi – Conversational AI Agent

Minimi is a conversational AI agent built with TypeScript and Node.js. It combines web search with date-aware conversational memory to answer questions about previous discussions and verify changing information using current web sources.

## Features

- **Conversational memory:** Stores user and assistant messages in SQLite.
- **Date-aware retrieval:** Retrieves conversation history for specific dates and relative expressions such as yesterday and last Tuesday.
- **Full-text search:** Uses SQLite FTS5 to find relevant messages from previous conversations.
- **Web search:** Uses Tavily to retrieve current information and relevant sources.
- **AI-powered responses:** Uses Google's Gemini API with function calling.
- **Source attribution:** Includes source links for web-based answers.
- **Timezone awareness:** Supports configurable user timezones.

## Tech Stack

- Node.js
- TypeScript
- Express.js
- Google Gemini API
- Tavily Search API
- SQLite with FTS5
- Luxon
- Zod

## Architecture

Minimi exposes exactly one tool to the AI model: `web_search`.

Conversation memory retrieval is handled internally by the backend using SQLite and is not exposed as an additional AI tool.

The application follows this flow:

1. Receives a user message through the chat API.
2. Retrieves recent and relevant conversation history.
3. Detects date-specific memory requests when applicable.
4. Uses Gemini to determine whether web search is needed.
5. Executes web search through Tavily when requested.
6. Sends search evidence to Gemini to generate a grounded response.
7. Stores the user message and assistant response in SQLite.

## Prerequisites

- Node.js
- npm
- Google Gemini API key
- Tavily API key

## Installation

Clone the repository:

```bash
git clone YOUR_GITHUB_REPOSITORY_URL
cd minimi-chat-agent
```

Install dependencies:

```bash
npm install
```

Create a `.env` file in the project root using `.env.example` as a template.

Configure the following variables:

```env
GEMINI_API_KEY=your_gemini_api_key_here
TAVILY_API_KEY=your_tavily_api_key_here
USER_TIME_ZONE=Asia/Kolkata
```

## Running the Application

Development mode:

```bash
npm run dev
```

Build:

```bash
npm run build
```

Production mode:

```bash
npm start
```

The backend runs at:

`http://localhost:3000`

Health check:

`GET /health`

Chat endpoint:

`POST /chat`

Example request:

```json
{
  "message": "What did we discuss yesterday?"
}
```

## Environment Variables

| Variable | Description |
|---|---|
| GEMINI_API_KEY | Google Gemini API key |
| TAVILY_API_KEY | Tavily search API key |
| USER_TIME_ZONE | Timezone used for date-aware memory retrieval |

## Project Structure

```text
minimi-chat-agent/
├── src/
│   ├── ai.ts
│   ├── database.ts
│   ├── date-utils.ts
│   ├── server.ts
│   └── web-search.ts
├── .env.example
├── .gitignore
├── package.json
├── package-lock.json
├── tsconfig.json
├── README.md
└── DESIGN.md
```

## Future Improvements

- Add automated tests for memory retrieval and search.
- Improve memory ranking and relevance.
- Add conversation management and deletion.
- Improve response streaming and latency.
- Add deployment and monitoring support.