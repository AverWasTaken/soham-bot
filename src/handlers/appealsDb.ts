/**
 * Appeals database handler - stores and manages punishment appeals in SQLite
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path
const dbDir = join(__dirname, '..', '..', 'data');
const dbPath = join(dbDir, 'appeals.db');

// Ensure data directory exists
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Initialize database with better options
let db: Database.Database;

try {
  db = new Database(dbPath, {
    verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
  });
  
  // Enable WAL mode for better concurrency
  db.pragma('journal_mode = WAL');
  
  // Enable foreign keys
  db.pragma('foreign_keys = ON');
  
  console.log('✓ Appeals database connected successfully');
} catch (error) {
  console.error('❌ Failed to connect to appeals database:', error);
  throw error;
}

/**
 * Appeal status types
 */
export enum AppealStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DENIED = 'DENIED',
}

/**
 * Appeal data structure
 */
export interface AppealData {
  appealId: string;
  userId: string;
  userTag: string;
  guildId: string;
  guildName: string;
  status: AppealStatus;
  punishmentType: string;
  punishmentReason: string;
  appealReason: string;
  whatHappened: string;
  whyUnpunish: string;
  preventFuture: string;
  reviewerId?: string;
  reviewerTag?: string;
  reviewNote?: string;
  timestamp: number;
  reviewedAt?: number;
}

/**
 * Initialize the appeals table
 */
function initDatabase() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS appeals (
        appealId TEXT PRIMARY KEY,
        userId TEXT NOT NULL,
        userTag TEXT NOT NULL,
        guildId TEXT NOT NULL,
        guildName TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'PENDING',
        punishmentType TEXT NOT NULL,
        punishmentReason TEXT NOT NULL,
        appealReason TEXT NOT NULL,
        whatHappened TEXT NOT NULL,
        whyUnpunish TEXT NOT NULL,
        preventFuture TEXT NOT NULL,
        reviewerId TEXT,
        reviewerTag TEXT,
        reviewNote TEXT,
        timestamp INTEGER NOT NULL,
        reviewedAt INTEGER
      );
      
      CREATE INDEX IF NOT EXISTS idx_user ON appeals(userId);
      CREATE INDEX IF NOT EXISTS idx_status ON appeals(status);
      CREATE INDEX IF NOT EXISTS idx_guild ON appeals(guildId);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON appeals(timestamp);
    `);
    
    console.log('✓ Appeals database tables initialized');
  } catch (error) {
    console.error('❌ Failed to initialize appeals database tables:', error);
    throw error;
  }
}

// Initialize on load
initDatabase();

/**
 * Generate a random appeal ID
 * @returns Random 6-character appeal ID (e.g., "APL-XfgTy")
 */
export function generateAppealId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let appealId = '';
  
  // Keep generating until we get a unique ID
  do {
    appealId = 'APL-';
    for (let i = 0; i < 5; i++) {
      appealId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (appealExists(appealId));
  
  return appealId;
}

/**
 * Check if an appeal ID already exists
 * @param appealId - Appeal ID to check
 * @returns True if appeal exists
 */
function appealExists(appealId: string): boolean {
  const stmt = db.prepare('SELECT appealId FROM appeals WHERE appealId = ?');
  return stmt.get(appealId) !== undefined;
}

/**
 * Add a new appeal to the database
 * @param appealData - Appeal data to add
 * @returns The appeal ID
 */
export function addAppeal(appealData: Omit<AppealData, 'appealId' | 'timestamp' | 'status'>): string {
  const appealId = generateAppealId();
  const timestamp = Date.now();
  
  const stmt = db.prepare(`
    INSERT INTO appeals (
      appealId, userId, userTag, guildId, guildName, status,
      punishmentType, punishmentReason, appealReason, whatHappened,
      whyUnpunish, preventFuture, timestamp
    )
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    appealId,
    appealData.userId,
    appealData.userTag,
    appealData.guildId,
    appealData.guildName,
    AppealStatus.PENDING,
    appealData.punishmentType,
    appealData.punishmentReason,
    appealData.appealReason,
    appealData.whatHappened,
    appealData.whyUnpunish,
    appealData.preventFuture,
    timestamp
  );
  
  console.log(`✓ Appeal ${appealId} created by ${appealData.userTag}`);
  
  return appealId;
}

/**
 * Get an appeal by ID
 * @param appealId - Appeal ID to retrieve
 * @returns Appeal data or null if not found
 */
export function getAppeal(appealId: string): AppealData | null {
  const stmt = db.prepare('SELECT * FROM appeals WHERE appealId = ?');
  const result = stmt.get(appealId) as any;
  
  if (!result) {
    return null;
  }
  
  return {
    appealId: result.appealId,
    userId: result.userId,
    userTag: result.userTag,
    guildId: result.guildId,
    guildName: result.guildName,
    status: result.status as AppealStatus,
    punishmentType: result.punishmentType,
    punishmentReason: result.punishmentReason,
    appealReason: result.appealReason,
    whatHappened: result.whatHappened,
    whyUnpunish: result.whyUnpunish,
    preventFuture: result.preventFuture,
    reviewerId: result.reviewerId || undefined,
    reviewerTag: result.reviewerTag || undefined,
    reviewNote: result.reviewNote || undefined,
    timestamp: result.timestamp,
    reviewedAt: result.reviewedAt || undefined,
  };
}

/**
 * Get pending appeals for a user
 * @param userId - User ID to search for
 * @returns Array of pending appeals
 */
export function getPendingAppealsForUser(userId: string): AppealData[] {
  const stmt = db.prepare('SELECT * FROM appeals WHERE userId = ? AND status = ? ORDER BY timestamp DESC');
  const results = stmt.all(userId, AppealStatus.PENDING) as any[];
  
  return results.map(result => ({
    appealId: result.appealId,
    userId: result.userId,
    userTag: result.userTag,
    guildId: result.guildId,
    guildName: result.guildName,
    status: result.status as AppealStatus,
    punishmentType: result.punishmentType,
    punishmentReason: result.punishmentReason,
    appealReason: result.appealReason,
    whatHappened: result.whatHappened,
    whyUnpunish: result.whyUnpunish,
    preventFuture: result.preventFuture,
    reviewerId: result.reviewerId || undefined,
    reviewerTag: result.reviewerTag || undefined,
    reviewNote: result.reviewNote || undefined,
    timestamp: result.timestamp,
    reviewedAt: result.reviewedAt || undefined,
  }));
}

/**
 * Update appeal status (accept or deny)
 * @param appealId - Appeal ID to update
 * @param status - New status
 * @param reviewerId - ID of the reviewer
 * @param reviewerTag - Tag of the reviewer
 * @param reviewNote - Optional note from reviewer
 * @returns True if updated successfully, false if appeal not found
 */
export function updateAppealStatus(
  appealId: string,
  status: AppealStatus,
  reviewerId: string,
  reviewerTag: string,
  reviewNote?: string
): boolean {
  const reviewedAt = Date.now();
  
  const stmt = db.prepare(`
    UPDATE appeals
    SET status = ?, reviewerId = ?, reviewerTag = ?, reviewNote = ?, reviewedAt = ?
    WHERE appealId = ?
  `);
  
  const result = stmt.run(status, reviewerId, reviewerTag, reviewNote || null, reviewedAt, appealId);
  
  if (result.changes > 0) {
    console.log(`✓ Appeal ${appealId} ${status.toLowerCase()} by ${reviewerTag}`);
    return true;
  }
  
  return false;
}

/**
 * Get all pending appeals
 * @returns Array of pending appeals
 */
export function getAllPendingAppeals(): AppealData[] {
  const stmt = db.prepare('SELECT * FROM appeals WHERE status = ? ORDER BY timestamp ASC');
  const results = stmt.all(AppealStatus.PENDING) as any[];
  
  return results.map(result => ({
    appealId: result.appealId,
    userId: result.userId,
    userTag: result.userTag,
    guildId: result.guildId,
    guildName: result.guildName,
    status: result.status as AppealStatus,
    punishmentType: result.punishmentType,
    punishmentReason: result.punishmentReason,
    appealReason: result.appealReason,
    whatHappened: result.whatHappened,
    whyUnpunish: result.whyUnpunish,
    preventFuture: result.preventFuture,
    reviewerId: result.reviewerId || undefined,
    reviewerTag: result.reviewerTag || undefined,
    reviewNote: result.reviewNote || undefined,
    timestamp: result.timestamp,
    reviewedAt: result.reviewedAt || undefined,
  }));
}

/**
 * Close the database connection gracefully
 */
export function closeAppealsDatabase(): void {
  try {
    if (db) {
      // Run checkpoint to flush WAL to main database
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
      console.log('✓ Appeals database closed successfully');
    }
  } catch (error) {
    console.error('❌ Error closing appeals database:', error);
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

