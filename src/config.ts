/**
 * Centralized configuration for constants that don't require environment variables.
 * Channel IDs remain hardcoded per user's preference.
 */

// Channels
export const AUTOMOD_LOG_CHANNEL_ID = '1430323983596781719';
export const ALLOWED_ASK_CHANNEL_ID = '1413097388398084106';

// Roles
export const FULL_MODERATOR_ROLE_IDS = [
  '1413096128223645766',
  '1413096630777020456',
  '1435043086576255129',
  '1414858050631766049',
  '1413096399469412374',
];

export const TRIAL_MODERATOR_ROLE_IDS = [
  '1437587664051372032',
];

// Senior moderator/admin roles (for elevated permissions like clearing all cases)
export const SENIOR_MODERATOR_ROLE_IDS = [
  '1413096128223645766', // Highest role (if applicable)
  '1413096630777020456', // Required role specified by user
];

// Prefix helper (reads env if present, falls back to default)
export function getPrefix(): string {
  return (process.env.PREFIX || 'v!').trim();
}


