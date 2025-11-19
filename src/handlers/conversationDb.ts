/**
 * Conversation Database - SQLite storage for user conversations with AI
 * Stores conversation history for context-aware AI responses
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const DB_PATH = join(__dirname, '..', '..', 'conversations.db');

let db: Database.Database | null = null;

/**
 * Initialize the conversations database
 */
function initializeDatabase(): Database.Database {
  if (db) return db;

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');

  db.exec(`
    CREATE TABLE IF NOT EXISTS conversations (
      userId TEXT PRIMARY KEY,
      messages TEXT NOT NULL,
      createdAt INTEGER,
      updatedAt INTEGER
    )
  `);

  return db;
}

/**
 * Get the database connection
 */
export function getDatabase(): Database.Database {
  return initializeDatabase();
}

/**
 * Store or update a conversation
 */
export function storeConversation(
  userId: string,
  messages: Array<{ role: string; content: string; timestamp: number }>
): void {
  const database = getDatabase();
  const now = Date.now();
  const messageJson = JSON.stringify(messages);

  const stmt = database.prepare(`
    INSERT INTO conversations (userId, messages, createdAt, updatedAt)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(userId) DO UPDATE SET
      messages = excluded.messages,
      updatedAt = excluded.updatedAt
  `);

  stmt.run(userId, messageJson, now, now);
}

/**
 * Get a conversation for a user
 */
export function getConversation(
  userId: string
): Array<{ role: string; content: string; timestamp: number }> {
  const database = getDatabase();

  const stmt = database.prepare(`
    SELECT messages FROM conversations WHERE userId = ?
  `);

  const row = stmt.get(userId) as { messages: string } | undefined;

  if (!row) return [];

  try {
    return JSON.parse(row.messages);
  } catch {
    return [];
  }
}

/**
 * Delete a conversation for a user
 */
export function deleteConversation(userId: string): void {
  const database = getDatabase();

  const stmt = database.prepare(`
    DELETE FROM conversations WHERE userId = ?
  `);

  stmt.run(userId);
}

/**
 * Clear all conversations (admin only)
 */
export function clearAllConversations(): void {
  const database = getDatabase();
  database.prepare('DELETE FROM conversations').run();
}

/**
 * Get all active conversations (for cleanup)
 */
export function getAllConversations(): Array<{ userId: string; updatedAt: number }> {
  const database = getDatabase();

  const stmt = database.prepare(`
    SELECT userId, updatedAt FROM conversations
  `);

  return stmt.all() as Array<{ userId: string; updatedAt: number }>;
}

/**
 * Close the database connection
 */
export async function closeDatabase(): Promise<void> {
  if (db) {
    db.close();
    db = null;
  }
}

