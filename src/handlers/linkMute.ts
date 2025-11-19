/**
 * Link Mute handler - Manages users restricted from sending links
 * Stores muted users in a JSON file for persistence
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const LINK_MUTE_FILE = join(__dirname, '..', '..', 'linkmutes.json');

interface LinkMutedUser {
  userId: string;
  mutedBy: string;
  mutedAt: number;
}

/**
 * Initialize link mute file if it doesn't exist
 */
function initializeLinkMuteFile(): void {
  if (!existsSync(LINK_MUTE_FILE)) {
    writeFileSync(LINK_MUTE_FILE, JSON.stringify([], null, 2));
  }
}

/**
 * Load all link-muted users from file
 */
export function getLinkMutedUsers(): LinkMutedUser[] {
  try {
    initializeLinkMuteFile();
    const data = readFileSync(LINK_MUTE_FILE, 'utf-8');
    return JSON.parse(data) as LinkMutedUser[];
  } catch (error) {
    console.error('Error reading link-muted users:', error);
    return [];
  }
}

/**
 * Check if a user is link-muted
 * @param userId - The user ID to check
 * @returns Whether the user is link-muted
 */
export function isUserLinkMuted(userId: string): boolean {
  const mutedUsers = getLinkMutedUsers();
  return mutedUsers.some(u => u.userId === userId);
}

/**
 * Add a user to the link mute list
 * @param userId - The user ID to mute
 * @param mutedBy - The moderator who muted them
 * @returns Whether the user was added successfully
 */
export function addLinkMutedUser(userId: string, mutedBy: string): boolean {
  try {
    initializeLinkMuteFile();
    const mutedUsers = getLinkMutedUsers();

    // Check if user is already muted
    if (mutedUsers.some(u => u.userId === userId)) {
      throw new Error('User already link-muted');
    }

    mutedUsers.push({
      userId,
      mutedBy,
      mutedAt: Date.now(),
    });

    writeFileSync(LINK_MUTE_FILE, JSON.stringify(mutedUsers, null, 2));
    return true;
  } catch (error) {
    console.error('Error adding link-muted user:', error);
    throw error;
  }
}

/**
 * Remove a user from the link mute list
 * @param userId - The user ID to unmute
 * @returns Whether the user was removed successfully
 */
export function removeLinkMutedUser(userId: string): boolean {
  try {
    initializeLinkMuteFile();
    const mutedUsers = getLinkMutedUsers();
    const filtered = mutedUsers.filter(u => u.userId !== userId);

    if (filtered.length === mutedUsers.length) {
      throw new Error('User not found');
    }

    writeFileSync(LINK_MUTE_FILE, JSON.stringify(filtered, null, 2));
    return true;
  } catch (error) {
    console.error('Error removing link-muted user:', error);
    throw error;
  }
}

/**
 * Check if a message contains links
 * @param content - The message content to check
 * @returns Whether the message contains links
 */
export function messageContainsLinks(content: string): boolean {
  // Check for HTTP/HTTPS URLs
  const urlRegex = /https?:\/\/[^\s]+/gi;
  return urlRegex.test(content);
}

