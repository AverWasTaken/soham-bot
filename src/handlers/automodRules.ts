/**
 * Automod Rules - Detection rules for various automod violations
 * 
 * Rules:
 * - Anti-spam (rate limiting)
 * - Anti-mention spam (too many mentions)
 * - Anti-zalgo (excessive weird characters)
 * - Discord invite detection
 * - Emoji spam detection
 */

import { Message } from 'discord.js';

/**
 * User message tracking for spam detection
 */
interface UserMessageTracker {
  messages: Array<{ content: string; timestamp: number }>;
  lastCleanup: number;
}

// Track messages per user for spam detection
const userMessageTracking = new Map<string, UserMessageTracker>();

/**
 * Spam detection configuration
 */
const SPAM_CONFIG = {
  messageLimit: 5,        // Max messages in time window
  timeWindow: 5000,       // Time window in ms (5 seconds)
  duplicateThreshold: 3,  // Max duplicate messages
  similarityThreshold: 0.8, // Similarity ratio for duplicate detection
};

/**
 * Mention spam configuration
 */
const MENTION_CONFIG = {
  maxMentions: 5,         // Max mentions per message
};

/**
 * Zalgo/weird characters configuration
 */
const ZALGO_CONFIG = {
  maxSpecialChars: 40,    // Max special/combining characters (increased to reduce false positives)
  specialCharRatio: 0.7,  // Max ratio of special chars to total length (increased to reduce false positives)
};

/**
 * Emoji spam configuration
 */
const EMOJI_CONFIG = {
  maxEmojis: 10,          // Max emojis per message
};

/**
 * Discord invite patterns
 */
const DISCORD_INVITE_PATTERNS = [
  /discord\.gg\/[a-zA-Z0-9]+/gi,
  /discord\.com\/invite\/[a-zA-Z0-9]+/gi,
  /discordapp\.com\/invite\/[a-zA-Z0-9]+/gi,
];

/**
 * Check for spam (rate limiting)
 * @param message - Discord message
 * @returns { flagged: boolean, reason?: string }
 */
export function checkSpam(message: Message): { flagged: boolean; reason?: string } {
  const userId = message.author.id;
  const now = Date.now();
  
  // Get or create tracker
  let tracker = userMessageTracking.get(userId);
  if (!tracker) {
    tracker = { messages: [], lastCleanup: now };
    userMessageTracking.set(userId, tracker);
  }

  // Cleanup old messages
  tracker.messages = tracker.messages.filter(
    m => now - m.timestamp < SPAM_CONFIG.timeWindow
  );

  // Check rate limit
  if (tracker.messages.length >= SPAM_CONFIG.messageLimit) {
    return {
      flagged: true,
      reason: `Spam detected: ${tracker.messages.length + 1} messages in ${SPAM_CONFIG.timeWindow / 1000} seconds`,
    };
  }

  // Check for duplicate/similar messages
  const content = message.content.toLowerCase().trim();
  const duplicateCount = tracker.messages.filter(m => {
    const similarity = calculateSimilarity(content, m.content.toLowerCase().trim());
    return similarity >= SPAM_CONFIG.similarityThreshold;
  }).length;

  if (duplicateCount >= SPAM_CONFIG.duplicateThreshold - 1) { // -1 because current message not yet added
    return {
      flagged: true,
      reason: `Spam detected: Repeated similar messages (${duplicateCount + 1} times)`,
    };
  }

  // Add current message to tracker
  tracker.messages.push({ content, timestamp: now });

  return { flagged: false };
}

/**
 * Calculate similarity between two strings (simple Levenshtein-based)
 * @param str1 - First string
 * @param str2 - Second string
 * @returns Similarity ratio (0-1)
 */
function calculateSimilarity(str1: string, str2: string): number {
  if (str1 === str2) return 1;
  if (str1.length === 0 || str2.length === 0) return 0;

  // Simple character-based similarity
  const len1 = str1.length;
  const len2 = str2.length;
  const maxLen = Math.max(len1, len2);
  
  // Count matching characters
  let matches = 0;
  const minLen = Math.min(len1, len2);
  for (let i = 0; i < minLen; i++) {
    if (str1[i] === str2[i]) matches++;
  }

  return matches / maxLen;
}

/**
 * Check for mention spam
 * @param message - Discord message
 * @returns { flagged: boolean, reason?: string }
 */
export function checkMentionSpam(message: Message): { flagged: boolean; reason?: string } {
  const mentionCount = message.mentions.users.size + message.mentions.roles.size;
  
  if (mentionCount > MENTION_CONFIG.maxMentions) {
    return {
      flagged: true,
      reason: `Mention spam detected: ${mentionCount} mentions (max ${MENTION_CONFIG.maxMentions})`,
    };
  }

  return { flagged: false };
}

/**
 * Check for zalgo/excessive weird characters
 * @param message - Discord message
 * @returns { flagged: boolean, reason?: string }
 */
export function checkZalgo(message: Message): { flagged: boolean; reason?: string } {
  const content = message.content;
  
  // Focus on combining diacritical marks, which are the main issue with zalgo text
  // These marks stack on top of regular characters to create the distorted "zalgo" effect
  const combiningMarks = /[\u0300-\u036F\u1AB0-\u1AFF\u1DC0-\u1DFF\u20D0-\u20FF\uFE20-\uFE2F]/g;
  const combiningMatches = content.match(combiningMarks);
  const combiningCount = combiningMatches ? combiningMatches.length : 0;

  // Check absolute threshold for combining marks
  if (combiningCount > ZALGO_CONFIG.maxSpecialChars) {
    return {
      flagged: true,
      reason: `Zalgo text detected: ${combiningCount} combining characters`,
    };
  }

  // Check ratio of combining marks to total length
  // Only check ratio if message is short enough that ratio matters
  const totalLength = content.length;
  if (totalLength > 0 && totalLength < 100 && combiningCount / totalLength > ZALGO_CONFIG.specialCharRatio) {
    return {
      flagged: true,
      reason: `Zalgo text detected: ${Math.round((combiningCount / totalLength) * 100)}% combining characters`,
    };
  }

  return { flagged: false };
}

/**
 * Check for Discord invites
 * @param message - Discord message
 * @returns { flagged: boolean, reason?: string }
 */
export function checkDiscordInvite(message: Message): { flagged: boolean; reason?: string } {
  const content = message.content;
  
  for (const pattern of DISCORD_INVITE_PATTERNS) {
    if (pattern.test(content)) {
      return {
        flagged: true,
        reason: 'Discord invite link detected',
      };
    }
  }

  return { flagged: false };
}

/**
 * Check for emoji spam
 * @param message - Discord message
 * @returns { flagged: boolean, reason?: string }
 */
export function checkEmojiSpam(message: Message): { flagged: boolean; reason?: string } {
  const content = message.content;
  
  // Count Unicode emojis
  const emojiRegex = /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu;
  const unicodeEmojis = content.match(emojiRegex) || [];
  
  // Count custom Discord emojis
  const customEmojiRegex = /<a?:\w+:\d+>/g;
  const customEmojis = content.match(customEmojiRegex) || [];
  
  const totalEmojis = unicodeEmojis.length + customEmojis.length;
  
  if (totalEmojis > EMOJI_CONFIG.maxEmojis) {
    return {
      flagged: true,
      reason: `Emoji spam detected: ${totalEmojis} emojis (max ${EMOJI_CONFIG.maxEmojis})`,
    };
  }

  return { flagged: false };
}

/**
 * Clean up old message tracking data
 */
export function cleanupMessageTracking(): void {
  const now = Date.now();
  const cleanupThreshold = 60000; // Clean up every minute
  
  for (const [userId, tracker] of userMessageTracking.entries()) {
    // Remove old messages
    tracker.messages = tracker.messages.filter(
      m => now - m.timestamp < SPAM_CONFIG.timeWindow
    );
    
    // Remove empty trackers
    if (tracker.messages.length === 0 && now - tracker.lastCleanup > cleanupThreshold) {
      userMessageTracking.delete(userId);
    } else {
      tracker.lastCleanup = now;
    }
  }
}

/**
 * Get spam statistics for monitoring
 */
export function getSpamStats(): { trackedUsers: number; totalMessages: number } {
  let totalMessages = 0;
  for (const tracker of userMessageTracking.values()) {
    totalMessages += tracker.messages.length;
  }
  
  return {
    trackedUsers: userMessageTracking.size,
    totalMessages,
  };
}

