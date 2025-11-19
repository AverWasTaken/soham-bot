/**
 * Automod handler - Reduces code duplication for automod rule violations
 * Centralizes the pattern: delete message -> add infraction -> apply punishment -> log
 */

import { Message, Client, GuildMember } from 'discord.js';
import { logAutomodAction, AutomodActionType } from './automodLogger.js';
import {
  addInfraction,
  applyPunishment,
  InfractionType,
} from '../handlers/automodInfractions.js';

/**
 * Configuration for handling an automod violation
 */
export interface AutomodViolationConfig {
  message: Message;
  client: Client;
  infractionType: InfractionType;
  reason: string;
  logChannelId: string;
  consoleEmoji?: string;
}

/**
 * Handle an automod rule violation with tiered punishment system
 * Deletes message, adds infraction, applies punishment, and logs the action
 * 
 * @param config - Violation configuration
 * @returns True if handled successfully, false otherwise
 */
export async function handleAutomodViolation(config: AutomodViolationConfig): Promise<boolean> {
  const { message, client, infractionType, reason, logChannelId, consoleEmoji = '⚠️' } = config;
  
  try {
    // Delete the offending message
    await message.delete();
    console.log(`${consoleEmoji} ${infractionType} deleted from ${message.author.tag}: ${reason}`);
    
    // Add infraction and get punishment tier
    const punishment = addInfraction(message.author.id, message.guild!.id, infractionType);
    
    // Apply the punishment to the user (with channel announcement)
    await applyPunishment(message.member as GuildMember, punishment, reason, client, message.channel.id);
    
    // Log to automod channel
    await logAutomodAction(
      client,
      {
        type: AutomodActionType.CONTENT_FILTER,
        user: message.author,
        channelId: message.channel.id,
        reason: `${reason} | Punishment: ${punishment.label}`,
        deletedMessage: message.content,
      },
      logChannelId,
      message.guild!.name
    );
    
    return true;
  } catch (error) {
    console.error(`Error handling ${infractionType}:`, error);
    return false;
  }
}

/**
 * Handle a simple automod violation without tiered punishment
 * Just deletes message and logs the action
 * 
 * @param message - The message containing the violation
 * @param client - The Discord client
 * @param actionType - Type of automod action
 * @param reason - Reason for the action
 * @param logChannelId - Channel ID to log the action
 * @param additionalData - Optional additional data for logging
 * @returns True if handled successfully, false otherwise
 */
export async function handleSimpleAutomodViolation(
  message: Message,
  client: Client,
  actionType: AutomodActionType,
  reason: string,
  logChannelId: string,
  additionalData?: { sequenceDetected?: string }
): Promise<boolean> {
  try {
    // Delete the message
    await message.delete();
    
    // Log the action
    await logAutomodAction(
      client,
      {
        type: actionType,
        user: message.author,
        channelId: message.channel.id,
        reason,
        deletedMessage: message.content,
        ...additionalData,
      },
      logChannelId,
      message.guild?.name || 'Views'
    );
    
    console.log(`🚫 Automod: Deleted message from ${message.author.tag} - ${reason}`);
    return true;
  } catch (error) {
    console.error('Error handling automod violation:', error);
    return false;
  }
}

