
import { DatabaseSync } from "node:sqlite";

const db = new DatabaseSync("minimi.db");

// 1. Create the original messages table
db.exec(`
  CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
`);

// Improve performance of date-based memory searches
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_messages_created_at
  ON messages(created_at);
`);

console.log("Minimi date search index initialized!");

// 2. Create the full-text search index
db.exec(`
  CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts
  USING fts5(
    content,
    content='messages',
    content_rowid='id'
  );

  -- Automatically index new messages
  CREATE TRIGGER IF NOT EXISTS messages_ai
  AFTER INSERT ON messages
  BEGIN
    INSERT INTO messages_fts(rowid, content)
    VALUES (new.id, new.content);
  END;

  -- Remove indexed content when a message is deleted
  CREATE TRIGGER IF NOT EXISTS messages_ad
  AFTER DELETE ON messages
  BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, content)
    VALUES ('delete', old.id, old.content);
  END;

  -- Update the index when a message changes
  CREATE TRIGGER IF NOT EXISTS messages_au
  AFTER UPDATE ON messages
  BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, content)
    VALUES ('delete', old.id, old.content);

    INSERT INTO messages_fts(rowid, content)
    VALUES (new.id, new.content);
  END;

  -- Index all previously stored messages
  INSERT INTO messages_fts(messages_fts)
  VALUES ('rebuild');
`);

console.log("Minimi memory database and full-text index initialized!");

export default db;
