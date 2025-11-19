/**
 * Command utilities - shared functions for command handling
 */

import { GuildMember, Message } from 'discord.js';
import { isModerator, isFullModerator } from '../handlers/permissions.js';

// Authorized users who can use all commands
const AUTHORIZED_USER_IDS = ['932320320222822400', '685580500596686967', '1407154399783948389'];

/**
 * Parse user input to extract user ID from mention or direct ID
 * @param userInput - User mention or ID string
 * @returns User ID or null if invalid
 */
export function parseUserInput(userInput: string): string | null {
  // Check if it's a mention
  const mentionMatch = userInput.match(/^<@!?(\d+)>$/);
  if (mentionMatch) {
    return mentionMatch[1];
  }
  
  // Check if it's a direct user ID (17-19 digits)
  if (/^\d{17,19}$/.test(userInput)) {
    return userInput;
  }
  
  return null;
}

/**
 * Validation result for moderation actions
 */
export interface ModActionValidation {
  valid: boolean;
  error?: string;
}

/**
 * Validate if a moderation action can be performed
 * @param message - The message that triggered the command
 * @param targetMember - The target member to take action on (can be null for bans)
 * @param targetUserId - The target user ID
 * @param actionName - Name of the action (e.g., "ban", "kick", "mute")
 * @param requiredPermission - Required Discord permission
 * @returns Validation result
 */
export function validateModAction(
  message: Message,
  targetMember: GuildMember | null,
  targetUserId: string,
  actionName: string,
  requiredPermission: bigint
): ModActionValidation {
  // Check if user is trying to action themselves
  if (targetUserId === message.author.id) {
    return {
      valid: false,
      error: `❌ You cannot ${actionName} yourself.`,
    };
  }

  // Check if user is trying to action the bot
  if (targetUserId === message.client.user?.id) {
    return {
      valid: false,
      error: `❌ I cannot ${actionName} myself.`,
    };
  }

  // Check if trying to action another moderator (if member exists in server)
  if (targetMember && isModerator(targetMember)) {
    return {
      valid: false,
      error: `❌ You cannot ${actionName} another moderator.`,
    };
  }

  // Check bot's permissions
  if (!message.guild?.members.me?.permissions.has(requiredPermission)) {
    return {
      valid: false,
      error: `❌ I do not have permission to ${actionName} members.`,
    };
  }

  // Check role hierarchy (if member exists in server)
  if (targetMember && message.guild?.members.me) {
    if (targetMember.roles.highest.position >= message.guild.members.me.roles.highest.position) {
      return {
        valid: false,
        error: `❌ I cannot ${actionName} this user due to role hierarchy.`,
      };
    }
  }

  return { valid: true };
}

/**
 * Standard Discord API error codes
 */
export enum DiscordAPIError {
  MISSING_PERMISSIONS = 50013,
  UNKNOWN_USER = 10007,
  UNKNOWN_MEMBER = 10013,
  MISSING_ACCESS = 50001,
}

/**
 * Handle common Discord API errors with user-friendly messages
 * @param error - The error object
 * @param message - The message to reply to
 * @param actionName - Name of the action being performed
 */
export async function handleCommandError(
  error: any,
  message: Message,
  actionName: string
): Promise<void> {
  console.error(`Error executing ${actionName} command:`, error);

  let errorMessage = `❌ An error occurred: ${error.message}`;

  switch (error.code) {
    case DiscordAPIError.MISSING_PERMISSIONS:
      errorMessage = `❌ I do not have permission to ${actionName} this user.`;
      break;
    case DiscordAPIError.UNKNOWN_USER:
    case DiscordAPIError.UNKNOWN_MEMBER:
      errorMessage = '❌ User not found.';
      break;
    case DiscordAPIError.MISSING_ACCESS:
      errorMessage = '❌ I do not have access to perform this action.';
      break;
  }

  try {
    await message.reply(errorMessage);
  } catch (replyError) {
    console.error('Could not send error message:', replyError);
  }
}

/**
 * Check if command is used in a guild
 * @param message - The message to check
 * @returns True if in guild, false otherwise (also sends error message)
 */
export async function requireGuild(message: Message): Promise<boolean> {
  if (!message.guild) {
    await message.reply('❌ This command can only be used in a server.');
    return false;
  }
  return true;
}

/**
 * Check if user has moderator permissions (full or trial)
 * @param message - The message to check
 * @returns True if moderator, false otherwise (also sends error message)
 */
export async function requireModerator(message: Message): Promise<boolean> {
  // Allow authorized users regardless of role
  if (AUTHORIZED_USER_IDS.includes(message.author.id)) {
    return true;
  }

  if (!message.member || !isModerator(message.member)) {
    await message.reply('❌ You do not have permission to use this command.');
    return false;
  }
  return true;
}

/**
 * Check if user has full moderator permissions (not trial mod)
 * Required for ban, kick, and other restricted commands
 * @param message - The message to check
 * @returns True if full moderator, false otherwise (also sends error message)
 */
export async function requireFullModerator(message: Message): Promise<boolean> {
  // Allow authorized users regardless of role
  if (AUTHORIZED_USER_IDS.includes(message.author.id)) {
    return true;
  }

  if (!message.member || !isFullModerator(message.member)) {
    await message.reply('❌ You do not have permission to use this command. This command requires full moderator permissions.');
    return false;
  }
  return true;
}

