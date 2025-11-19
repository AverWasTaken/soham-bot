/**
 * Message event handlers - Extracted logic from main index file
 * Handles various message processing tasks like automod, greetings, dry replies, etc.
 */

import { Message, Client, PermissionFlagsBits } from 'discord.js';
import { checkMessage } from './automod.js';
import { checkBlacklist } from './blacklist.js';
import { trackUserSequence } from './sequenceDetector.js';
import { isUserLinkMuted, messageContainsLinks } from './linkMute.js';
import { logAutomodAction, AutomodActionType } from '../utils/automodLogger.js';
import { isExemptFromAutomod, InfractionType } from './automodInfractions.js';
import {
  checkSpam,
  checkMentionSpam,
  checkZalgo,
  checkDiscordInvite,
  checkEmojiSpam,
} from './automodRules.js';
import { handleAutomodViolation, handleSimpleAutomodViolation } from '../utils/automodHandler.js';

/**
 * Handle Discord invite links with immediate 5-minute mute
 * @returns True if invite was detected and handled, false otherwise
 */
async function handleDiscordInviteCheck(
  message: Message,
  client: Client,
  logChannelId: string
): Promise<boolean> {
  const inviteCheck = checkDiscordInvite(message);
  if (!inviteCheck.flagged || !message.guild || !message.member) return false;
  
  try {
    // Check bot permissions before taking actions
    const me = message.guild.members.me;
    if (!me) return false;

    const canDelete = me.permissions.has(PermissionFlagsBits.ManageMessages);
    const canTimeout = me.permissions.has(PermissionFlagsBits.ModerateMembers);

    if (!canDelete || !canTimeout) {
      console.warn('Missing permissions for invite automod:', {
        canDelete,
        canTimeout,
      });
      return false;
    }

    await message.delete();
    console.log(`🔗 Discord invite deleted from ${message.author.tag}`);
    
    // DM the user
    try {
      await message.author.send(
        `🔇 **You have been timed out** in **${message.guild.name}**\n\n` +
        `**Duration:** 5 minutes\n` +
        `**Reason:** Posting Discord invite links is not allowed\n\n` +
        `Please do not post invite links to other Discord servers.`
      );
    } catch {
      // User has DMs disabled
    }
    
    // Apply 5 minute mute immediately (no tiered punishment for invites)
    await message.member.timeout(5 * 60 * 1000, '[AUTOMOD] Posting Discord invite links');
    
    // Log to mod logs (creates case ID)
    const botUser = client.user;
    if (botUser) {
      const { logModAction, ModActionType } = await import('./modLog.js');
      const caseId = await logModAction({
        type: ModActionType.MUTE,
        moderator: {
          tag: 'AutoMod',
          id: botUser.id,
        },
        target: {
          tag: message.author.tag,
          id: message.author.id,
        },
        reason: `[AUTOMOD] ${inviteCheck.reason}`,
        duration: '5m',
        guild: {
          name: message.guild.name,
          id: message.guild.id,
        },
      });
      
      // Send announcement in channel
      try {
        if ('send' in message.channel) {
          await message.channel.send(
            `🔇 <@${message.author.id}> has been timed out for **5m** by AutoMod${caseId ? ` (Case #${caseId})` : ''}\n` +
            `**Reason:** ${inviteCheck.reason}`
          );
        }
      } catch (error) {
        console.error('Error sending invite mute announcement:', error);
      }
    }
    
    return true;
  } catch (error) {
    console.error('Error handling Discord invite:', error);
    return false;
  }
}

/**
 * Process all automod rules for a message in a guild
 * Checks spam, mention spam, zalgo, emoji spam, and Discord invites
 * 
 * @returns True if any rule was violated, false otherwise
 */
export async function processAutomodRules(
  message: Message,
  client: Client,
  logChannelId: string
): Promise<boolean> {
  // Skip automod checks for DMs or if user is exempt
  if (!message.guild || !message.member || isExemptFromAutomod(message.member)) {
    return false;
  }
  
  // Check for Discord invites (immediate 5 minute mute, no escalation)
  if (await handleDiscordInviteCheck(message, client, logChannelId)) {
    return true;
  }
  
  // Check for spam
  const spamCheck = checkSpam(message);
  if (spamCheck.flagged) {
    return await handleAutomodViolation({
      message,
      client,
      infractionType: InfractionType.SPAM,
      reason: spamCheck.reason || 'Spam detected',
      logChannelId,
      consoleEmoji: '💨',
    });
  }
  
  // Check for mention spam
  const mentionCheck = checkMentionSpam(message);
  if (mentionCheck.flagged) {
    return await handleAutomodViolation({
      message,
      client,
      infractionType: InfractionType.MENTION_SPAM,
      reason: mentionCheck.reason || 'Mention spam',
      logChannelId,
      consoleEmoji: '📢',
    });
  }
  
  // Check for zalgo/weird characters
  const zalgoCheck = checkZalgo(message);
  if (zalgoCheck.flagged) {
    return await handleAutomodViolation({
      message,
      client,
      infractionType: InfractionType.ZALGO,
      reason: zalgoCheck.reason || 'Zalgo/excessive special characters',
      logChannelId,
      consoleEmoji: '👾',
    });
  }
  
  // Check for emoji spam
  const emojiCheck = checkEmojiSpam(message);
  if (emojiCheck.flagged) {
    return await handleAutomodViolation({
      message,
      client,
      infractionType: InfractionType.EMOJI_SPAM,
      reason: emojiCheck.reason || 'Emoji spam',
      logChannelId,
      consoleEmoji: '😀',
    });
  }
  
  return false;
}

/**
 * Process general automod checks (inappropriate content, blacklist, sequence detection, link mute)
 * 
 * @returns True if message should be stopped from further processing, false otherwise
 */
export async function processGeneralAutomod(
  message: Message,
  client: Client,
  logChannelId: string
): Promise<boolean> {
  // Automod check - flag and delete inappropriate content
  const modCheck = await checkMessage(message.content);
  if (modCheck.flagged) {
    await handleSimpleAutomodViolation(
      message,
      client,
      AutomodActionType.CONTENT_FILTER,
      modCheck.reason || 'Inappropriate content detected',
      logChannelId
    );
    return true;
  }
  
  // Link mute check - prevent link-muted users from sending links
  if (isUserLinkMuted(message.author.id) && messageContainsLinks(message.content)) {
    await handleSimpleAutomodViolation(
      message,
      client,
      AutomodActionType.LINK_MUTE,
      'User is link-muted and attempted to send links',
      logChannelId
    );
    console.log(`🔇 Link-muted: Deleted message with links from ${message.author.tag}`);
    return true;
  }
  
  // Blacklist check - flag links, GIFs, and other blacklisted content
  const messageUrl = message.content + ' ' + Array.from(message.attachments.values()).map(a => a.url).join(' ');
  const blacklistCheck = checkBlacklist(message.content, messageUrl);
  if (blacklistCheck.flagged) {
    await handleSimpleAutomodViolation(
      message,
      client,
      AutomodActionType.BLACKLIST,
      blacklistCheck.reason || 'Blacklisted content detected',
      logChannelId
    );
    console.log(`🔗 Blacklist: Deleted message from ${message.author.tag}`);
    return true;
  }
  
  // Sequence detection - catch users typing out slurs letter by letter
  const sequenceCheck = trackUserSequence(message.author.id, message.content);
  if (sequenceCheck.flagged) {
    await handleSimpleAutomodViolation(
      message,
      client,
      AutomodActionType.SEQUENCE_DETECTION,
      'Flagged content sent in sequence',
      logChannelId,
      { sequenceDetected: sequenceCheck.sequence }
    );
    console.log(`⚠️ Sequence Bypass: Detected from ${message.author.tag}: "${sequenceCheck.sequence}"`);
    return true;
  }
  
  return false;
}


/**
 * Handle appeal messages in DMs
 * @returns True if appeal was handled, false otherwise
 */
export async function handleAppealMessage(message: Message, commands: any): Promise<boolean> {
  if (message.guild) return false; // Only in DMs
  
  const appealCommand = commands.get('appeal');
  if (!appealCommand || !appealCommand.handleMessage) return false;
  
  return await appealCommand.handleMessage(message);
}

