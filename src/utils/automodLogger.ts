/**
 * Automod logger - centralized logging for automod actions
 */

import { Client, TextChannel, User } from 'discord.js';

/**
 * Automod action types
 */
export enum AutomodActionType {
  CONTENT_FILTER = 'CONTENT_FILTER',
  LINK_MUTE = 'LINK_MUTE',
  BLACKLIST = 'BLACKLIST',
  SEQUENCE_DETECTION = 'SEQUENCE_DETECTION',
}

/**
 * Automod action data
 */
export interface AutomodActionData {
  type: AutomodActionType;
  user: User;
  channelId: string;
  reason: string;
  deletedMessage?: string;
  sequenceDetected?: string;
}

/**
 * Get embed color based on action type
 */
function getEmbedColor(type: AutomodActionType): number {
  switch (type) {
    case AutomodActionType.CONTENT_FILTER:
      return 0xFF0000; // Red
    case AutomodActionType.LINK_MUTE:
      return 0xFFA500; // Orange
    case AutomodActionType.BLACKLIST:
      return 0xFF6600; // Dark orange
    case AutomodActionType.SEQUENCE_DETECTION:
      return 0xFF00FF; // Magenta
    default:
      return 0xFF0000;
  }
}

/**
 * Get embed title based on action type
 */
function getEmbedTitle(type: AutomodActionType): string {
  switch (type) {
    case AutomodActionType.CONTENT_FILTER:
      return '🚫 Automod Deletion';
    case AutomodActionType.LINK_MUTE:
      return '🔇 Link-Muted User Blocked';
    case AutomodActionType.BLACKLIST:
      return '🔗 Blacklist Deletion';
    case AutomodActionType.SEQUENCE_DETECTION:
      return '⚠️ Sequence Bypass Detected';
    default:
      return '🚫 Automod Action';
  }
}

/**
 * Get DM message based on action type
 */
function getDMMessage(type: AutomodActionType, reason: string, guildName: string): string {
  switch (type) {
    case AutomodActionType.CONTENT_FILTER:
      return `⚠️ Your message in the ${guildName} server was removed for violating community guidelines.\n\nReason: ${reason}\n\nPlease review our server rules and guidelines.`;
    case AutomodActionType.LINK_MUTE:
      return `⚠️ Your message in the ${guildName} server was removed because you are restricted from sending links.\n\nIf you believe this is a mistake, please contact a moderator.`;
    case AutomodActionType.BLACKLIST:
      return `⚠️ Your message in the ${guildName} server was removed for containing blacklisted content.\n\nReason: ${reason}\n\nPlease review our server rules and guidelines.`;
    case AutomodActionType.SEQUENCE_DETECTION:
      return `⚠️ Your message in the ${guildName} server was removed for containing flagged content sent in sequence.\n\nPlease review our server rules and guidelines.`;
    default:
      return `⚠️ Your message in the ${guildName} server was removed.\n\nReason: ${reason}`;
  }
}

/**
 * Log an automod action to the channel and send DM to user
 * @param client - Discord client
 * @param data - Automod action data
 * @param logChannelId - Channel ID to log to
 * @param guildName - Name of the guild
 */
export async function logAutomodAction(
  client: Client,
  data: AutomodActionData,
  logChannelId: string,
  guildName: string
): Promise<void> {
  // Send DM to user
  try {
    const dmMessage = getDMMessage(data.type, data.reason, guildName);
    await data.user.send({ content: dmMessage });
  } catch {
    // Silently fail if we can't DM the user
  }

  // Log to automod channel
  try {
    const logChannel = await client.channels.fetch(logChannelId);
    if (logChannel && logChannel.isTextBased()) {
      const fields: Array<{ name: string; value: string; inline: boolean }> = [
        {
          name: 'User',
          value: `${data.user.tag} (${data.user.id})`,
          inline: true,
        },
        {
          name: 'Channel',
          value: `<#${data.channelId}>`,
          inline: true,
        },
        {
          name: 'Reason',
          value: data.reason,
          inline: false,
        },
      ];

      // Add sequence detected field if applicable
      if (data.type === AutomodActionType.SEQUENCE_DETECTION && data.sequenceDetected) {
        fields.push({
          name: 'Sequence Detected',
          value: `\`${data.sequenceDetected}\``,
          inline: false,
        });
      }

      // Add deleted message field if applicable
      if (data.deletedMessage && data.type !== AutomodActionType.SEQUENCE_DETECTION) {
        fields.push({
          name: 'Deleted Message',
          value: `\`\`\`\n${data.deletedMessage.substring(0, 1024)}\n\`\`\``,
          inline: false,
        });
      }

      const logEmbed = {
        color: getEmbedColor(data.type),
        title: getEmbedTitle(data.type),
        fields,
        timestamp: new Date().toISOString(),
      };

      await (logChannel as TextChannel).send({ embeds: [logEmbed] });
    }
  } catch (logError) {
    console.error('Error logging to automod channel:', logError);
  }
}

