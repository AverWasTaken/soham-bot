/**
 * Automod Infractions Tracker - Tracks violations and applies tiered punishments
 * 
 * Infractions expire after 7 days
 * 
 * Punishment tiers:
 * 1. First offense: Warning (logged)
 * 2. Second offense: 10 minute mute
 * 3. Third offense: 10 minute mute
 * 4. Fourth offense: 1 hour mute
 * 5. Fifth offense: 5 hour mute
 * 6. Sixth offense: 1 day mute
 * 7. Seventh+ offense: 1 day mute (continues)
 */

import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync, mkdirSync } from 'fs';
import { GuildMember, Client, PermissionFlagsBits } from 'discord.js';
import { logModAction, ModActionType } from './modLog.js';
import { isModerator } from './permissions.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Database path
const dbDir = join(__dirname, '..', '..', 'data');
const dbPath = join(dbDir, 'automod_infractions.db');

// Ensure data directory exists
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

// Initialize database
let db: Database.Database;

try {
  db = new Database(dbPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  console.log('✓ Automod infractions database connected');
} catch (error) {
  console.error('❌ Failed to connect to automod infractions database:', error);
  throw error;
}

/**
 * Infraction types
 */
export enum InfractionType {
  SPAM = 'SPAM',
  MENTION_SPAM = 'MENTION_SPAM',
  ZALGO = 'ZALGO',
  DISCORD_INVITE = 'DISCORD_INVITE',
  EMOJI_SPAM = 'EMOJI_SPAM',
}

/**
 * Infraction data
 */
export interface InfractionData {
  userId: string;
  guildId: string;
  type: InfractionType;
  timestamp: number;
  punishmentApplied: string; // 'warning', '10m', '1h', '5h', '1d', etc.
}

/**
 * Punishment tier configuration
 */
const PUNISHMENT_TIERS = [
  { count: 1, duration: null, label: 'warning' },           // Warning
  { count: 2, duration: 10 * 60 * 1000, label: '10m' },     // 10 minutes
  { count: 3, duration: 10 * 60 * 1000, label: '10m' },     // 10 minutes
  { count: 4, duration: 60 * 60 * 1000, label: '1h' },      // 1 hour
  { count: 5, duration: 5 * 60 * 60 * 1000, label: '5h' },  // 5 hours
  { count: 6, duration: 24 * 60 * 60 * 1000, label: '1d' }, // 1 day
  // 7+ continues with 1 day
];

/**
 * Initialize database tables
 */
function initDatabase() {
  try {
    db.exec(`
      CREATE TABLE IF NOT EXISTS automod_infractions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        userId TEXT NOT NULL,
        guildId TEXT NOT NULL,
        type TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        punishmentApplied TEXT NOT NULL
      );
      
      CREATE INDEX IF NOT EXISTS idx_user_guild ON automod_infractions(userId, guildId);
      CREATE INDEX IF NOT EXISTS idx_timestamp ON automod_infractions(timestamp);
    `);
    console.log('✓ Automod infractions database initialized');
  } catch (error) {
    console.error('❌ Failed to initialize automod infractions database:', error);
    throw error;
  }
}

// Initialize on load
initDatabase();

/**
 * Check if a member should be exempt from automod infractions
 * Exempts: Moderators, Administrators, and Server Owner
 * @param member - Guild member to check
 * @returns True if member should be exempt
 */
export function isExemptFromAutomod(member: GuildMember): boolean {
  // Check if server owner
  if (member.id === member.guild.ownerId) {
    return true;
  }

  // Check if has administrator permission
  if (member.permissions.has(PermissionFlagsBits.Administrator)) {
    return true;
  }

  // Check if is moderator (has specific mod roles)
  if (isModerator(member)) {
    return true;
  }

  return false;
}

/**
 * Get infraction count for a user in the last 7 days
 * @param userId - User ID
 * @param guildId - Guild ID
 * @returns Number of infractions
 */
export function getRecentInfractionCount(userId: string, guildId: string): number {
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const stmt = db.prepare(`
    SELECT COUNT(*) as count 
    FROM automod_infractions 
    WHERE userId = ? AND guildId = ? AND timestamp > ?
  `);
  const result = stmt.get(userId, guildId, oneWeekAgo) as any;
  return result.count;
}

/**
 * Add an infraction and return the punishment to apply
 * @param userId - User ID
 * @param guildId - Guild ID
 * @param type - Infraction type
 * @returns Punishment to apply { duration: ms | null, label: string }
 */
export function addInfraction(
  userId: string,
  guildId: string,
  type: InfractionType
): { duration: number | null; label: string } {
  // Get current count
  const currentCount = getRecentInfractionCount(userId, guildId);
  const newCount = currentCount + 1;

  // Determine punishment tier
  let punishment = PUNISHMENT_TIERS[PUNISHMENT_TIERS.length - 1]; // Default to last tier
  for (const tier of PUNISHMENT_TIERS) {
    if (newCount === tier.count) {
      punishment = tier;
      break;
    }
  }

  // Add to database
  const stmt = db.prepare(`
    INSERT INTO automod_infractions (userId, guildId, type, timestamp, punishmentApplied)
    VALUES (?, ?, ?, ?, ?)
  `);
  stmt.run(userId, guildId, type, Date.now(), punishment.label);

  console.log(
    `📋 Infraction added: User ${userId} | Type: ${type} | Count: ${newCount} | Punishment: ${punishment.label}`
  );

  return { duration: punishment.duration, label: punishment.label };
}

/**
 * Apply punishment to a member
 * @param member - Guild member to punish
 * @param punishment - Punishment details
 * @param reason - Reason for punishment
 * @param client - Discord client (for logging)
 * @param channelId - Optional channel ID to send announcement
 * @returns Case ID if created
 */
export async function applyPunishment(
  member: GuildMember,
  punishment: { duration: number | null; label: string },
  reason: string,
  client: Client,
  channelId?: string
): Promise<string | undefined> {
  const botUser = client.user;
  if (!botUser) return undefined;

  // If it's a warning, just log it
  if (punishment.duration === null) {
    console.log(`⚠️ Warning issued to ${member.user.tag}: ${reason}`);
    
    // Try to DM the user
    try {
      await member.send(
        `⚠️ **Warning** - You have received an automated warning in **${member.guild.name}**\n\n` +
        `**Reason:** ${reason}\n\n` +
        `Continued violations will result in temporary mutes.`
      );
    } catch {
      // User has DMs disabled
    }

    // Log as warning to mod logs
    const caseId = await logModAction({
      type: ModActionType.WARN,
      moderator: {
        tag: 'AutoMod',
        id: botUser.id,
      },
      target: {
        tag: member.user.tag,
        id: member.id,
      },
      reason: `[AUTOMOD] ${reason}`,
      guild: {
        name: member.guild.name,
        id: member.guild.id,
      },
    });

    // Send announcement in channel if channelId provided
    if (channelId) {
      try {
        const channel = await client.channels.fetch(channelId);
        if (channel?.isTextBased() && 'send' in channel) {
          await channel.send(
            `⚠️ <@${member.id}> has been warned by AutoMod${caseId ? ` (Case #${caseId})` : ''}\n` +
            `**Reason:** ${reason}`
          );
        }
      } catch (error) {
        console.error('Error sending warning announcement:', error);
      }
    }

    return caseId;
  }

  // Apply timeout
  try {
    await member.timeout(punishment.duration, `[AUTOMOD] ${reason}`);
    console.log(`🔇 Muted ${member.user.tag} for ${punishment.label}: ${reason}`);

    // Try to DM the user
    try {
      const timeoutUntil = new Date(Date.now() + punishment.duration);
      await member.send(
        `🔇 **You have been timed out** in **${member.guild.name}**\n\n` +
        `**Duration:** ${punishment.label}\n` +
        `**Reason:** ${reason}\n` +
        `**Timeout Until:** <t:${Math.floor(timeoutUntil.getTime() / 1000)}:F>\n\n` +
        `This is an automated punishment based on repeated violations.`
      );
    } catch {
      // User has DMs disabled
    }

    // Log to mod logs
    const caseId = await logModAction({
      type: ModActionType.MUTE,
      moderator: {
        tag: 'AutoMod',
        id: botUser.id,
      },
      target: {
        tag: member.user.tag,
        id: member.id,
      },
      reason: `[AUTOMOD] ${reason}`,
      duration: punishment.label,
      guild: {
        name: member.guild.name,
        id: member.guild.id,
      },
    });

    // Send announcement in channel if channelId provided
    if (channelId) {
      try {
        const channel = await client.channels.fetch(channelId);
        if (channel?.isTextBased() && 'send' in channel) {
          await channel.send(
            `🔇 <@${member.id}> has been timed out for **${punishment.label}** by AutoMod${caseId ? ` (Case #${caseId})` : ''}\n` +
            `**Reason:** ${reason}`
          );
        }
      } catch (error) {
        console.error('Error sending mute announcement:', error);
      }
    }

    return caseId;
  } catch (error) {
    console.error(`Error applying punishment to ${member.user.tag}:`, error);
    return undefined;
  }
}

/**
 * Clean up old infractions (older than 7 days)
 */
export function cleanupOldInfractions(): void {
  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const stmt = db.prepare('DELETE FROM automod_infractions WHERE timestamp < ?');
  const result = stmt.run(oneWeekAgo);
  if (result.changes > 0) {
    console.log(`🧹 Cleaned up ${result.changes} old automod infractions`);
  }
}

/**
 * Clear all infractions for a specific user in a guild
 * @param userId - User ID
 * @param guildId - Guild ID
 * @returns Number of infractions cleared
 */
export function clearUserInfractions(userId: string, guildId: string): number {
  const stmt = db.prepare('DELETE FROM automod_infractions WHERE userId = ? AND guildId = ?');
  const result = stmt.run(userId, guildId);
  return result.changes;
}

/**
 * Get all infractions for a user
 * @param userId - User ID
 * @param guildId - Guild ID
 * @returns Array of infractions
 */
export function getUserInfractions(userId: string, guildId: string): InfractionData[] {
  const stmt = db.prepare(`
    SELECT userId, guildId, type, timestamp, punishmentApplied
    FROM automod_infractions
    WHERE userId = ? AND guildId = ?
    ORDER BY timestamp DESC
  `);
  const results = stmt.all(userId, guildId) as any[];
  
  return results.map(r => ({
    userId: r.userId,
    guildId: r.guildId,
    type: r.type as InfractionType,
    timestamp: r.timestamp,
    punishmentApplied: r.punishmentApplied,
  }));
}

