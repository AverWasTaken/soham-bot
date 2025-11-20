/**
 * Moderation logging handler - logs mod actions to database
 */

import { addCase } from './casesDb.js';

/**
 * Map to store the most recent case ID for each moderator
 * Key: moderatorId, Value: caseId
 */
const recentCasesByModerator = new Map<string, string>();

/**
 * Moderation action types
 */
export enum ModActionType {
  BAN = 'BAN',
  UNBAN = 'UNBAN',
  KICK = 'KICK',
  MUTE = 'MUTE',
  UNMUTE = 'UNMUTE',
  WARN = 'WARN',
  PURGE = 'PURGE',
}

/**
 * Moderation action data
 */
export interface ModActionData {
  type: ModActionType;
  moderator: {
    tag: string;
    id: string;
  };
  target?: {
    tag: string;
    id: string;
  };
  reason?: string;
  duration?: string;
  messageCount?: number;
  channel?: {
    name: string;
    id: string;
  };
  guild: {
    name: string;
    id: string;
  };
  additionalInfo?: string;
}

/**
 * Log a moderation action to the database
 * @param data - Moderation action data
 * @returns Case ID if created, undefined for purge actions
 */
export async function logModAction(data: ModActionData): Promise<string | undefined> {
  let caseId: string | undefined;

  // Save to database (except for purge actions)
  if (data.type !== ModActionType.PURGE && data.target) {
    try {
      caseId = addCase({
        type: data.type,
        targetId: data.target.id,
        targetTag: data.target.tag,
        moderatorId: data.moderator.id,
        moderatorTag: data.moderator.tag,
        reason: data.reason || 'No reason provided',
        duration: data.duration,
        guildId: data.guild.id,
        guildName: data.guild.name,
      });
      
      // Store the most recent case for this moderator
      if (caseId) {
        recentCasesByModerator.set(data.moderator.id, caseId);
      }
    } catch (error) {
      console.error('Error saving case to database:', error);
    }
  }

  return caseId;
}


/**
 * Get the most recent case ID for a moderator
 * @param moderatorId - Moderator's Discord ID
 * @returns Case ID if exists, undefined otherwise
 */
export function getRecentCaseForModerator(moderatorId: string): string | undefined {
  return recentCasesByModerator.get(moderatorId);
}

