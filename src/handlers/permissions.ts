/**
 * Permissions handler - centralized permission checking for moderation commands
 */

import { GuildMember } from 'discord.js';
import { FULL_MODERATOR_ROLE_IDS, TRIAL_MODERATOR_ROLE_IDS, SENIOR_MODERATOR_ROLE_IDS } from '../config.js';

/**
 * Check if a user has full moderator permissions (can use all commands including ban/kick)
 * @param member - The guild member to check
 * @returns True if the user has any of the full moderator roles
 */
export function isFullModerator(member: GuildMember | null | undefined): boolean {
  if (!member || !member.roles) {
    return false;
  }

  // Check if user has any of the full moderator roles
  return FULL_MODERATOR_ROLE_IDS.some((roleId: string) => member.roles.cache.has(roleId));
}

/**
 * Check if a user has trial moderator permissions (limited commands)
 * @param member - The guild member to check
 * @returns True if the user has any of the trial moderator roles
 */
export function isTrialModerator(member: GuildMember | null | undefined): boolean {
  if (!member || !member.roles) {
    return false;
  }

  // Check if user has any of the trial moderator roles
  return TRIAL_MODERATOR_ROLE_IDS.some((roleId: string) => member.roles.cache.has(roleId));
}

/**
 * Check if a user has moderator permissions (full or trial)
 * @param member - The guild member to check
 * @returns True if the user has any moderator role (full or trial)
 */
export function isModerator(member: GuildMember | null | undefined): boolean {
  return isFullModerator(member) || isTrialModerator(member);
}

/**
 * Check if a user has senior moderator/admin permissions
 * @param member - The guild member to check
 * @returns True if the user has any of the senior moderator roles
 */
export function isSeniorModerator(member: GuildMember | null | undefined): boolean {
  if (!member || !member.roles) {
    return false;
  }

  // Check if user has any of the senior moderator roles
  return SENIOR_MODERATOR_ROLE_IDS.some((roleId: string) => member.roles.cache.has(roleId));
}

/**
 * Get the list of full moderator role IDs
 * @returns Array of full moderator role IDs
 */
export function getModeratorRoleIds(): string[] {
  return [...FULL_MODERATOR_ROLE_IDS];
}

/**
 * Get the list of trial moderator role IDs
 * @returns Array of trial moderator role IDs
 */
export function getTrialModeratorRoleIds(): string[] {
  return [...TRIAL_MODERATOR_ROLE_IDS];
}

