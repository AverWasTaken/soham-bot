/**
 * Moderation logging handler - sends all mod actions to a webhook and database
 */

import { EmbedBuilder, WebhookClient } from 'discord.js';
import { addCase } from './casesDb.js';

const WEBHOOK_URL = 'https://discord.com/api/webhooks/1436176344659656799/ylkjy0CScLZJt1z0_5DR_S-Px9fllNVKxWzW5rLFJfrWSp0q1sjNhH3gnIwhmBI0F6zc';

/**
 * Initialize webhook client
 */
const webhookClient = new WebhookClient({ url: WEBHOOK_URL });

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
 * Log a moderation action to the webhook and database
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

  // Send to webhook
  try {
    const embed = createModLogEmbed(data, caseId);
    await webhookClient.send({
      embeds: [embed],
      username: 'Views Moderation',
      avatarURL: 'https://cdn.discordapp.com/embed/avatars/0.png',
    });
  } catch (error) {
    console.error('Error sending moderation log to webhook:', error);
  }

  return caseId;
}

/**
 * Create an embed for a moderation action
 * @param data - Moderation action data
 * @param caseId - Optional case ID
 * @returns Discord embed
 */
function createModLogEmbed(data: ModActionData, caseId?: string): EmbedBuilder {
  const embed = new EmbedBuilder()
    .setTimestamp()
    .setFooter({ text: caseId ? `Case ID: ${caseId} | Guild: ${data.guild.name}` : `Guild: ${data.guild.name}` });

  switch (data.type) {
    case ModActionType.BAN:
      embed
        .setColor(0xFF0000)
        .setTitle('User Banned')
        .addFields(
          { name: 'User', value: `${data.target?.tag} (${data.target?.id})`, inline: true },
          { name: 'Moderator', value: `${data.moderator.tag} (${data.moderator.id})`, inline: true },
          { name: 'Reason', value: data.reason || 'No reason provided', inline: false }
        );
      break;

    case ModActionType.KICK:
      embed
        .setColor(0xFF6600)
        .setTitle('User Kicked')
        .addFields(
          { name: 'User', value: `${data.target?.tag} (${data.target?.id})`, inline: true },
          { name: 'Moderator', value: `${data.moderator.tag} (${data.moderator.id})`, inline: true },
          { name: 'Reason', value: data.reason || 'No reason provided', inline: false }
        );
      break;

    case ModActionType.MUTE:
      embed
        .setColor(0xFFA500)
        .setTitle('User Timed Out')
        .addFields(
          { name: 'User', value: `${data.target?.tag} (${data.target?.id})`, inline: true },
          { name: 'Moderator', value: `${data.moderator.tag} (${data.moderator.id})`, inline: true },
          { name: 'Duration', value: data.duration || 'Unknown', inline: true },
          { name: 'Reason', value: data.reason || 'No reason provided', inline: false }
        );
      if (data.additionalInfo) {
        embed.addFields({ name: 'Timeout Until', value: data.additionalInfo, inline: false });
      }
      break;

    case ModActionType.UNMUTE:
      embed
        .setColor(0x00FF00)
        .setTitle('Timeout Removed')
        .addFields(
          { name: 'User', value: `${data.target?.tag} (${data.target?.id})`, inline: true },
          { name: 'Moderator', value: `${data.moderator.tag} (${data.moderator.id})`, inline: true },
          { name: 'Reason', value: data.reason || 'No reason provided', inline: false }
        );
      break;

    case ModActionType.WARN:
      embed
        .setColor(0xFFFF00)
        .setTitle('User Warned')
        .addFields(
          { name: 'User', value: `${data.target?.tag} (${data.target?.id})`, inline: true },
          { name: 'Moderator', value: `${data.moderator.tag} (${data.moderator.id})`, inline: true },
          { name: 'Reason', value: data.reason || 'No reason provided', inline: false }
        );
      if (data.additionalInfo) {
        embed.addFields({ name: 'Additional Info', value: data.additionalInfo, inline: false });
      }
      break;

    case ModActionType.PURGE:
      embed
        .setColor(0x9B59B6)
        .setTitle('Messages Purged')
        .addFields(
          { name: 'Moderator', value: `${data.moderator.tag} (${data.moderator.id})`, inline: true },
          { name: 'Channel', value: `#${data.channel?.name} (${data.channel?.id})`, inline: true },
          { name: 'Messages Deleted', value: `${data.messageCount || 0}`, inline: true }
        );
      if (data.additionalInfo) {
        embed.addFields({ name: 'Details', value: data.additionalInfo, inline: false });
      }
      break;
  }

  return embed;
}

/**
 * Test the webhook connection
 */
export async function testWebhook(): Promise<boolean> {
  try {
    const testEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('Webhook Test')
      .setDescription('Moderation logging system is working correctly!')
      .setTimestamp();

    await webhookClient.send({
      embeds: [testEmbed],
      username: 'Views Moderation',
    });

    return true;
  } catch (error) {
    console.error('Webhook test failed:', error);
    return false;
  }
}

/**
 * Get the most recent case ID for a moderator
 * @param moderatorId - Moderator's Discord ID
 * @returns Case ID if exists, undefined otherwise
 */
export function getRecentCaseForModerator(moderatorId: string): string | undefined {
  return recentCasesByModerator.get(moderatorId);
}

