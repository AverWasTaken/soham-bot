/**
 * Moderator Actions database handler - tracks all moderation actions taken by moderators
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path
const dbDir = join(__dirname, '..', '..', 'data');
const dbPath = join(dbDir, 'modActions.db');

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
  
  console.log('✓ Mod Actions database connected successfully');
} catch (error) {
  console.error('❌ Failed to connect to mod actions database:', error);
  throw error;
}

/**
 * Moderator action data structure
 */
export interface ModActionData {
  id?: number;
  moderatorId: string;
  moderatorTag: string;
  actionType: 'WARN' | 'MUTE' | 'UNMUTE' | 'KICK' | 'BAN' | 'UNBAN';
  targetId: string;
  targetTag: string;
  reason: string;
  guildId: string;
  guildName: string;
  caseId?: string;
  timestamp: number;
}

/**
 * Action statistics for a moderator
 */
export interface ModActionStats {
  moderatorId: string;
  moderatorTag: string;
  totalActions: number;
  warns: number;
  mutes: number;
  unmutes: number;
  kicks: number;
  bans: number;
  unbans: number;
}

/**
 * Initialize the mod actions table
 */
function initDatabase() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS mod_actions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        moderatorId TEXT NOT NULL,
        moderatorTag TEXT NOT NULL,
        actionType TEXT NOT NULL,
        targetId TEXT NOT NULL,
        targetTag TEXT NOT NULL,
        reason TEXT NOT NULL,
        guildId TEXT NOT NULL,
        guildName TEXT NOT NULL,
        caseId TEXT,
        timestamp INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_mod_actions_moderator ON mod_actions(moderatorId);
      CREATE INDEX IF NOT EXISTS idx_mod_actions_guild ON mod_actions(guildId);
      CREATE INDEX IF NOT EXISTS idx_mod_actions_timestamp ON mod_actions(timestamp);
      CREATE INDEX IF NOT EXISTS idx_mod_actions_type ON mod_actions(actionType);
      CREATE INDEX IF NOT EXISTS idx_mod_actions_guild_mod ON mod_actions(guildId, moderatorId);
    `);
    
    console.log('✓ Mod Actions database tables initialized');
  } catch (error) {
    console.error('❌ Failed to initialize mod actions database tables:', error);
    throw error;
  }
}

// Initialize on load
initDatabase();

/**
 * Log a moderator action
 * @param action - Action data to log
 * @returns The action ID
 */
export function logModeratorAction(action: Omit<ModActionData, 'id' | 'timestamp'>): number {
  const timestamp = Date.now();
  
  const stmt = db.prepare(`
    INSERT INTO mod_actions (moderatorId, moderatorTag, actionType, targetId, targetTag, reason, guildId, guildName, caseId, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  const result = stmt.run(
    action.moderatorId,
    action.moderatorTag,
    action.actionType,
    action.targetId,
    action.targetTag,
    action.reason,
    action.guildId,
    action.guildName,
    action.caseId || null,
    timestamp
  );
  
  console.log(`✓ Logged mod action: ${action.moderatorTag} used ${action.actionType} on ${action.targetTag}`);
  
  return result.lastInsertRowid as number;
}

/**
 * Get statistics for a moderator
 * @param moderatorId - Moderator's user ID
 * @param guildId - Optional guild ID filter
 * @returns Action statistics
 */
export function getModeratorStats(moderatorId: string, guildId?: string): ModActionStats | null {
  let query = `
    SELECT 
      moderatorId,
      moderatorTag,
      COUNT(*) as totalActions,
      SUM(CASE WHEN actionType = 'WARN' THEN 1 ELSE 0 END) as warns,
      SUM(CASE WHEN actionType = 'MUTE' THEN 1 ELSE 0 END) as mutes,
      SUM(CASE WHEN actionType = 'UNMUTE' THEN 1 ELSE 0 END) as unmutes,
      SUM(CASE WHEN actionType = 'KICK' THEN 1 ELSE 0 END) as kicks,
      SUM(CASE WHEN actionType = 'BAN' THEN 1 ELSE 0 END) as bans,
      SUM(CASE WHEN actionType = 'UNBAN' THEN 1 ELSE 0 END) as unbans
    FROM mod_actions
    WHERE moderatorId = ?
  `;
  
  let params: any[] = [moderatorId];
  
  if (guildId) {
    query += ' AND guildId = ?';
    params.push(guildId);
  }
  
  query += ' GROUP BY moderatorId, moderatorTag';
  
  const stmt = db.prepare(query);
  const result = stmt.get(...params) as any;
  
  if (!result) {
    return null;
  }
  
  return {
    moderatorId: result.moderatorId,
    moderatorTag: result.moderatorTag,
    totalActions: result.totalActions,
    warns: result.warns,
    mutes: result.mutes,
    unmutes: result.unmutes,
    kicks: result.kicks,
    bans: result.bans,
    unbans: result.unbans,
  };
}

/**
 * Get recent actions by a moderator
 * @param moderatorId - Moderator's user ID
 * @param limit - Number of actions to retrieve
 * @param guildId - Optional guild ID filter
 * @returns Array of recent actions
 */
export function getModeratorRecentActions(
  moderatorId: string,
  limit: number = 10,
  guildId?: string
): ModActionData[] {
  let query = 'SELECT * FROM mod_actions WHERE moderatorId = ?';
  let params: any[] = [moderatorId];
  
  if (guildId) {
    query += ' AND guildId = ?';
    params.push(guildId);
  }
  
  query += ' ORDER BY timestamp DESC LIMIT ?';
  params.push(limit);
  
  const stmt = db.prepare(query);
  const results = stmt.all(...params) as any[];
  
  return results.map(result => ({
    id: result.id,
    moderatorId: result.moderatorId,
    moderatorTag: result.moderatorTag,
    actionType: result.actionType,
    targetId: result.targetId,
    targetTag: result.targetTag,
    reason: result.reason,
    guildId: result.guildId,
    guildName: result.guildName,
    caseId: result.caseId || undefined,
    timestamp: result.timestamp,
  }));
}

/**
 * Get all actions by a moderator
 * @param moderatorId - Moderator's user ID
 * @param guildId - Optional guild ID filter
 * @returns Array of all actions
 */
export function getAllModeratorActions(moderatorId: string, guildId?: string): ModActionData[] {
  let query = 'SELECT * FROM mod_actions WHERE moderatorId = ?';
  let params: any[] = [moderatorId];
  
  if (guildId) {
    query += ' AND guildId = ?';
    params.push(guildId);
  }
  
  query += ' ORDER BY timestamp DESC';
  
  const stmt = db.prepare(query);
  const results = stmt.all(...params) as any[];
  
  return results.map(result => ({
    id: result.id,
    moderatorId: result.moderatorId,
    moderatorTag: result.moderatorTag,
    actionType: result.actionType,
    targetId: result.targetId,
    targetTag: result.targetTag,
    reason: result.reason,
    guildId: result.guildId,
    guildName: result.guildName,
    caseId: result.caseId || undefined,
    timestamp: result.timestamp,
  }));
}

/**
 * Close the database connection gracefully
 */
export function closeModActionsDatabase(): void {
  try {
    if (db) {
      // Run checkpoint to flush WAL to main database
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
      console.log('✓ Mod Actions database closed successfully');
    }
  } catch (error) {
    console.error('❌ Error closing mod actions database:', error);
  }
}

/**
 * Check if database connection is open
 * @returns True if database is open
 */
export function isModActionsDatabaseOpen(): boolean {
  try {
    return db && db.open;
  } catch {
    return false;
  }
}

