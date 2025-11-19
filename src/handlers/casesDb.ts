/**
 * Cases database handler - stores moderation cases in SQLite
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path
const dbDir = join(__dirname, '..', '..', 'data');
const dbPath = join(dbDir, 'cases.db');

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
  
  console.log('✓ Cases database connected successfully');
} catch (error) {
  console.error('❌ Failed to connect to cases database:', error);
  throw error;
}

/**
 * Case data structure
 */
export interface CaseData {
  caseId: string;
  type: 'BAN' | 'UNBAN' | 'KICK' | 'MUTE' | 'UNMUTE' | 'WARN';
  targetId: string;
  targetTag: string;
  moderatorId: string;
  moderatorTag: string;
  reason: string;
  duration?: string;
  proof?: string;
  guildId: string;
  guildName: string;
  timestamp: number;
}

/**
 * Initialize the cases table
 */
function initDatabase() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS cases (
        caseId TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        targetId TEXT NOT NULL,
        targetTag TEXT NOT NULL,
        moderatorId TEXT NOT NULL,
        moderatorTag TEXT NOT NULL,
        reason TEXT NOT NULL,
        duration TEXT,
        proof TEXT,
        guildId TEXT NOT NULL,
        guildName TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_target ON cases(targetId);
      CREATE INDEX IF NOT EXISTS idx_moderator ON cases(moderatorId);
      CREATE INDEX IF NOT EXISTS idx_guild ON cases(guildId);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON cases(timestamp);
      CREATE INDEX IF NOT EXISTS idx_type ON cases(type);
      CREATE INDEX IF NOT EXISTS idx_guild_target ON cases(guildId, targetId);
    `);
    
    // Add proof column if it doesn't exist (for existing databases)
    const tableInfo = db.pragma('table_info(cases)') as Array<{ name: string }>;
    const hasProof = tableInfo.some((col) => col.name === 'proof');
    if (!hasProof) {
      db.exec('ALTER TABLE cases ADD COLUMN proof TEXT');
      console.log('✓ Added proof column to existing cases table');
    }
    
    console.log('✓ Cases database tables initialized');
  } catch (error) {
    console.error('❌ Failed to initialize cases database tables:', error);
    throw error;
  }
}

// Initialize on load
initDatabase();

/**
 * Generate a random case ID
 * @returns Random 5-character case ID (e.g., "XfgTy")
 */
export function generateCaseId(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let caseId = '';
  
  // Keep generating until we get a unique ID
  do {
    caseId = '';
    for (let i = 0; i < 5; i++) {
      caseId += chars.charAt(Math.floor(Math.random() * chars.length));
    }
  } while (caseExists(caseId));
  
  return caseId;
}

/**
 * Check if a case ID already exists
 * @param caseId - Case ID to check
 * @returns True if case exists
 */
function caseExists(caseId: string): boolean {
  const stmt = db.prepare('SELECT caseId FROM cases WHERE caseId = ?');
  return stmt.get(caseId) !== undefined;
}

/**
 * Add a new case to the database
 * @param caseData - Case data to add
 * @returns The case ID
 */
export function addCase(caseData: Omit<CaseData, 'caseId' | 'timestamp'>): string {
  const caseId = generateCaseId();
  const timestamp = Date.now();
  
  const stmt = db.prepare(`
    INSERT INTO cases (caseId, type, targetId, targetTag, moderatorId, moderatorTag, reason, duration, proof, guildId, guildName, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  stmt.run(
    caseId,
    caseData.type,
    caseData.targetId,
    caseData.targetTag,
    caseData.moderatorId,
    caseData.moderatorTag,
    caseData.reason,
    caseData.duration || null,
    caseData.proof || null,
    caseData.guildId,
    caseData.guildName,
    timestamp
  );
  
  console.log(`✓ Case ${caseId} created: ${caseData.type} for ${caseData.targetTag}`);
  
  return caseId;
}

/**
 * Get a case by ID
 * @param caseId - Case ID to retrieve
 * @returns Case data or null if not found
 */
export function getCase(caseId: string): CaseData | null {
  const stmt = db.prepare('SELECT * FROM cases WHERE caseId = ?');
  const result = stmt.get(caseId) as any;
  
  if (!result) {
    return null;
  }
  
  return {
    caseId: result.caseId,
    type: result.type,
    targetId: result.targetId,
    targetTag: result.targetTag,
    moderatorId: result.moderatorId,
    moderatorTag: result.moderatorTag,
    reason: result.reason,
    duration: result.duration || undefined,
    proof: result.proof || undefined,
    guildId: result.guildId,
    guildName: result.guildName,
    timestamp: result.timestamp,
  };
}

/**
 * Get all cases for a specific user
 * @param userId - User ID to search for
 * @param guildId - Optional guild ID filter
 * @returns Array of cases
 */
export function getCasesByUser(userId: string, guildId?: string): CaseData[] {
  let stmt;
  let results;
  
  if (guildId) {
    stmt = db.prepare('SELECT * FROM cases WHERE targetId = ? AND guildId = ? ORDER BY timestamp DESC');
    results = stmt.all(userId, guildId) as any[];
  } else {
    stmt = db.prepare('SELECT * FROM cases WHERE targetId = ? ORDER BY timestamp DESC');
    results = stmt.all(userId) as any[];
  }
  
  return results.map(result => ({
    caseId: result.caseId,
    type: result.type,
    targetId: result.targetId,
    targetTag: result.targetTag,
    moderatorId: result.moderatorId,
    moderatorTag: result.moderatorTag,
    reason: result.reason,
    duration: result.duration || undefined,
    proof: result.proof || undefined,
    guildId: result.guildId,
    guildName: result.guildName,
    timestamp: result.timestamp,
  }));
}

/**
 * Delete a case by ID
 * @param caseId - Case ID to delete
 * @returns True if deleted, false if not found
 */
export function deleteCase(caseId: string): boolean {
  const stmt = db.prepare('DELETE FROM cases WHERE caseId = ?');
  const result = stmt.run(caseId);
  
  if (result.changes > 0) {
    console.log(`✓ Case ${caseId} deleted`);
    return true;
  }
  
  return false;
}

/**
 * Delete all cases for a specific user
 * @param userId - User ID to delete cases for
 * @param guildId - Optional guild ID filter
 * @returns Number of cases deleted
 */
export function deleteAllCasesForUser(userId: string, guildId?: string): number {
  let stmt;
  let result;
  
  if (guildId) {
    stmt = db.prepare('DELETE FROM cases WHERE targetId = ? AND guildId = ?');
    result = stmt.run(userId, guildId);
  } else {
    stmt = db.prepare('DELETE FROM cases WHERE targetId = ?');
    result = stmt.run(userId);
  }
  
  const deletedCount = result.changes;
  
  if (deletedCount > 0) {
    console.log(`✓ Deleted ${deletedCount} case${deletedCount !== 1 ? 's' : ''} for user ${userId}`);
  }
  
  return deletedCount;
}

/**
 * Get total number of cases for a user
 * @param userId - User ID
 * @param guildId - Optional guild ID filter
 * @returns Number of cases
 */
export function getCaseCount(userId: string, guildId?: string): number {
  let stmt;
  let result;
  
  if (guildId) {
    stmt = db.prepare('SELECT COUNT(*) as count FROM cases WHERE targetId = ? AND guildId = ?');
    result = stmt.get(userId, guildId) as any;
  } else {
    stmt = db.prepare('SELECT COUNT(*) as count FROM cases WHERE targetId = ?');
    result = stmt.get(userId) as any;
  }
  
  return result.count;
}

/**
 * Get recent cases (last N cases)
 * @param limit - Number of cases to retrieve
 * @param guildId - Optional guild ID filter
 * @returns Array of cases
 */
export function getRecentCases(limit: number = 10, guildId?: string): CaseData[] {
  let stmt;
  let results;
  
  if (guildId) {
    stmt = db.prepare('SELECT * FROM cases WHERE guildId = ? ORDER BY timestamp DESC LIMIT ?');
    results = stmt.all(guildId, limit) as any[];
  } else {
    stmt = db.prepare('SELECT * FROM cases ORDER BY timestamp DESC LIMIT ?');
    results = stmt.all(limit) as any[];
  }
  
  return results.map(result => ({
    caseId: result.caseId,
    type: result.type,
    targetId: result.targetId,
    targetTag: result.targetTag,
    moderatorId: result.moderatorId,
    moderatorTag: result.moderatorTag,
    reason: result.reason,
    duration: result.duration || undefined,
    proof: result.proof || undefined,
    guildId: result.guildId,
    guildName: result.guildName,
    timestamp: result.timestamp,
  }));
}

/**
 * Close the database connection gracefully
 */
export function closeCasesDatabase(): void {
  try {
    if (db) {
      // Run checkpoint to flush WAL to main database
      db.pragma('wal_checkpoint(TRUNCATE)');
      db.close();
      console.log('✓ Cases database closed successfully');
    }
  } catch (error) {
    console.error('❌ Error closing cases database:', error);
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

/**
 * Optimize database - run VACUUM and ANALYZE
 */
export function optimizeDatabase(): void {
  try {
    console.log('Running database optimization...');
    db.exec('VACUUM');
    db.exec('ANALYZE');
    console.log('✓ Database optimization complete');
  } catch (error) {
    console.error('❌ Error optimizing database:', error);
  }
}

/**
 * Update proof for a case (appends to existing proof if any)
 * @param caseId - Case ID to update
 * @param proof - Proof URL or text to add
 * @returns True if updated successfully, false if case not found
 */
export function updateCaseProof(caseId: string, proof: string): boolean {
  // Get existing case
  const existingCase = getCase(caseId);
  
  if (!existingCase) {
    return false;
  }
  
  // Append to existing proof or set new proof
  const newProof = existingCase.proof 
    ? `${existingCase.proof}\n${proof}` 
    : proof;
  
  const stmt = db.prepare('UPDATE cases SET proof = ? WHERE caseId = ?');
  const result = stmt.run(newProof, caseId);
  
  if (result.changes > 0) {
    console.log(`✓ Case ${caseId} proof updated`);
    return true;
  }
  
  return false;
}

