/**
 * Generic cooldown manager for rate-limiting user actions
 * Prevents spam and abuse across different bot features
 */

/**
 * Cooldown tracker instance
 */
export interface CooldownTracker {
  cooldowns: Map<string, number>;
  duration: number;
}

/**
 * Creates a new cooldown tracker
 * @param durationMs - Cooldown duration in milliseconds
 * @returns A cooldown tracker instance
 */
export function createCooldownTracker(durationMs: number): CooldownTracker {
  return {
    cooldowns: new Map<string, number>(),
    duration: durationMs,
  };
}

/**
 * Check if a user can perform an action (not on cooldown)
 * @param tracker - The cooldown tracker instance
 * @param userId - The user ID to check
 * @returns True if user can act, false if on cooldown
 */
export function canAct(tracker: CooldownTracker, userId: string): boolean {
  const lastAction = tracker.cooldowns.get(userId);
  if (!lastAction) return true;
  
  const timeSince = Date.now() - lastAction;
  return timeSince >= tracker.duration;
}

/**
 * Set cooldown for a user after they perform an action
 * @param tracker - The cooldown tracker instance
 * @param userId - The user ID to set cooldown for
 */
export function setCooldown(tracker: CooldownTracker, userId: string): void {
  tracker.cooldowns.set(userId, Date.now());
  
  // Auto-cleanup after cooldown expires to prevent memory leaks
  setTimeout(() => {
    tracker.cooldowns.delete(userId);
  }, tracker.duration);
}

/**
 * Get remaining cooldown time for a user
 * @param tracker - The cooldown tracker instance
 * @param userId - The user ID to check
 * @returns Remaining cooldown time in milliseconds, or 0 if no cooldown
 */
export function getRemainingCooldown(tracker: CooldownTracker, userId: string): number {
  const lastAction = tracker.cooldowns.get(userId);
  if (!lastAction) return 0;
  
  const timeSince = Date.now() - lastAction;
  const remaining = tracker.duration - timeSince;
  
  return remaining > 0 ? remaining : 0;
}

/**
 * Clear cooldown for a specific user
 * @param tracker - The cooldown tracker instance
 * @param userId - The user ID to clear
 */
export function clearCooldown(tracker: CooldownTracker, userId: string): void {
  tracker.cooldowns.delete(userId);
}

/**
 * Clear all cooldowns
 * @param tracker - The cooldown tracker instance
 */
export function clearAllCooldowns(tracker: CooldownTracker): void {
  tracker.cooldowns.clear();
}

