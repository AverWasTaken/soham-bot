/**
 * Punishment tracker - tracks recent punishments for appeal system
 * Stores punishment info when users are punished so they can easily appeal
 */

export interface TrackedPunishment {
  userId: string;
  userTag: string;
  guildId: string;
  guildName: string;
  punishmentType: 'ban' | 'kick' | 'mute' | 'warn';
  reason: string;
  timestamp: number;
}

// Store recent punishments (kept for 30 days)
const recentPunishments = new Map<string, TrackedPunishment>();

// Cleanup interval (every hour)
const CLEANUP_INTERVAL = 60 * 60 * 1000;
// Keep punishments for 30 days
const PUNISHMENT_EXPIRY = 30 * 24 * 60 * 60 * 1000;

/**
 * Track a punishment for a user
 * @param punishment - Punishment data to track
 */
export function trackPunishment(punishment: TrackedPunishment): void {
  recentPunishments.set(punishment.userId, punishment);
  console.log(`📋 Tracked ${punishment.punishmentType} for ${punishment.userTag}`);
}

/**
 * Get the most recent punishment for a user
 * @param userId - User ID to check
 * @returns Punishment data or null if none found
 */
export function getRecentPunishment(userId: string): TrackedPunishment | null {
  const punishment = recentPunishments.get(userId);
  
  if (!punishment) {
    return null;
  }
  
  // Check if punishment is still valid (within 30 days)
  if (Date.now() - punishment.timestamp > PUNISHMENT_EXPIRY) {
    recentPunishments.delete(userId);
    return null;
  }
  
  return punishment;
}

/**
 * Remove a tracked punishment after appeal is submitted
 * @param userId - User ID to clear
 */
export function clearTrackedPunishment(userId: string): void {
  recentPunishments.delete(userId);
}

/**
 * Clean up expired punishments
 */
function cleanupExpiredPunishments(): void {
  const now = Date.now();
  let removed = 0;
  
  for (const [userId, punishment] of recentPunishments.entries()) {
    if (now - punishment.timestamp > PUNISHMENT_EXPIRY) {
      recentPunishments.delete(userId);
      removed++;
    }
  }
  
  if (removed > 0) {
    console.log(`🧹 Cleaned up ${removed} expired punishment(s)`);
  }
}

/**
 * Start periodic cleanup of expired punishments
 */
export function startPunishmentCleanup(): void {
  setInterval(cleanupExpiredPunishments, CLEANUP_INTERVAL);
  console.log('✓ Punishment tracker cleanup started');
}

/**
 * Get total tracked punishments (for debugging)
 */
export function getTrackedCount(): number {
  return recentPunishments.size;
}

