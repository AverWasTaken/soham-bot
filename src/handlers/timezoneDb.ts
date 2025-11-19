/**
 * Timezone database handler - stores user timezone preferences in SQLite
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path
const dbDir = join(__dirname, '..', '..', 'data');
const dbPath = join(dbDir, 'timezones.db');

// Ensure data directory exists
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Initialize database
let db: Database.Database;

try {
  db = new Database(dbPath, {
    verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
  });
  
  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  console.log('✓ Timezone database connected successfully');
} catch (error) {
  console.error('❌ Failed to connect to timezone database:', error);
  throw error;
}

/**
 * Timezone data structure
 */
export interface TimezoneData {
  userId: string;
  timezone: string;
  updatedAt: number;
}

/**
 * Initialize the timezones table
 */
function initDatabase() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS timezones (
        userId TEXT PRIMARY KEY,
        timezone TEXT NOT NULL,
        updatedAt INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_updated ON timezones(updatedAt);
    `);
    
    console.log('✓ Timezone database tables initialized');
  } catch (error) {
    console.error('❌ Failed to initialize timezone database tables:', error);
    throw error;
  }
}

// Initialize on load
initDatabase();

/**
 * Set or update a user's timezone
 * @param userId - User ID
 * @param timezone - IANA timezone identifier (e.g., "America/New_York")
 */
export function setUserTimezone(userId: string, timezone: string): void {
  const stmt = db.prepare(`
    INSERT INTO timezones (userId, timezone, updatedAt)
    VALUES (?, ?, ?)
    ON CONFLICT(userId) DO UPDATE SET
      timezone = excluded.timezone,
      updatedAt = excluded.updatedAt
  `);
  
  stmt.run(userId, timezone, Date.now());
  console.log(`✓ Timezone set for user ${userId}: ${timezone}`);
}

/**
 * Get a user's timezone
 * @param userId - User ID
 * @returns Timezone data or null if not found
 */
export function getUserTimezone(userId: string): TimezoneData | null {
  const stmt = db.prepare('SELECT * FROM timezones WHERE userId = ?');
  const result = stmt.get(userId) as any;
  
  if (!result) {
    return null;
  }
  
  return {
    userId: result.userId,
    timezone: result.timezone,
    updatedAt: result.updatedAt,
  };
}

/**
 * Delete a user's timezone
 * @param userId - User ID
 * @returns True if deleted, false if not found
 */
export function deleteUserTimezone(userId: string): boolean {
  const stmt = db.prepare('DELETE FROM timezones WHERE userId = ?');
  const result = stmt.run(userId);
  
  if (result.changes > 0) {
    console.log(`✓ Timezone deleted for user ${userId}`);
    return true;
  }
  
  return false;
}

/**
 * Close the database connection gracefully
 */
export function closeTimezoneDatabase(): void {
  try {
    if (db) {
      // Run checkpoint to flush WAL to main database
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
      console.log('✓ Timezone database closed successfully');
    }
  } catch (error) {
    console.error('❌ Error closing timezone database:', error);
  }
}

/**
 * Check if database connection is open
 * @returns True if database is open
 */
export function isDatabaseOpen(): boolean {
  try {
    return db && db.open;
  } catch {
    return false;
  }
}

