/**
 * Sequence Detector - Detects when users send characters in sequence to bypass automod
 * Tracks message sequences and flags suspicious patterns
 */

import { Collection } from 'discord.js';

interface UserSequence {
  userId: string;
  messages: string[];
  timestamp: number;
  combined: string;
}

// Store user sequences with a 10-second window
const userSequences = new Collection<string, UserSequence>();
const SEQUENCE_WINDOW_MS = 10000; // 10 seconds
const MIN_SEQUENCE_LENGTH = 3; // Minimum characters to consider suspicious

// Slur patterns to check sequences against
const SLUR_KEYWORDS = [
  'niga',
  'nigga',
  'nigger',
  'spick',
  'chink',
  'koon',
  'raghead',
  'cracker',
  'honky',
  'faggot',
  'dyke',
  'lesbo',
];

/**
 * Check if a sequence of messages contains a slur pattern
 */
function containsSlur(text: string): boolean {
  const normalized = text.toLowerCase().replace(/\s+/g, '');
  for (const slur of SLUR_KEYWORDS) {
    if (normalized.includes(slur)) {
      return true;
    }
  }
  return false;
}

/**
 * Track a user's message and check for sequence bypasses
 * Returns flagged status if a slur was detected in the sequence
 */
export function trackUserSequence(userId: string, messageContent: string): { flagged: boolean; sequence?: string } {
  const now = Date.now();
  const cleanedContent = messageContent.trim();

  // Only track short messages (single words or just letters/numbers)
  if (cleanedContent.length > 20) {
    // Reset sequence if they send a normal message
    userSequences.delete(userId);
    return { flagged: false };
  }

  // Get or create sequence
  let sequence = userSequences.get(userId);

  // Check if sequence has timed out
  if (sequence && now - sequence.timestamp > SEQUENCE_WINDOW_MS) {
    sequence = undefined;
  }

  if (!sequence) {
    // Start new sequence
    sequence = {
      userId,
      messages: [cleanedContent],
      timestamp: now,
      combined: cleanedContent,
    };
  } else {
    // Add to existing sequence
    sequence.messages.push(cleanedContent);
    sequence.combined += cleanedContent;
    sequence.timestamp = now;
  }

  // Update or store sequence
  userSequences.set(userId, sequence);

  // Check if combined sequence contains a slur
  if (sequence.combined.length >= MIN_SEQUENCE_LENGTH && containsSlur(sequence.combined)) {
    // Clear the sequence after detection
    userSequences.delete(userId);
    return {
      flagged: true,
      sequence: sequence.combined,
    };
  }

  return { flagged: false };
}

/**
 * Get user's current sequence (for debugging)
 */
export function getUserSequence(userId: string): string {
  const sequence = userSequences.get(userId);
  if (!sequence) {
    return '';
  }

  // Check if timed out
  if (Date.now() - sequence.timestamp > SEQUENCE_WINDOW_MS) {
    userSequences.delete(userId);
    return '';
  }

  return sequence.combined;
}

/**
 * Clear a user's sequence
 */
export function clearUserSequence(userId: string): void {
  userSequences.delete(userId);
}

/**
 * Get all active sequences (for debugging)
 */
export function getActiveSequences(): { userId: string; combined: string; messageCount: number }[] {
  const now = Date.now();
  const active = [];

  for (const [, sequence] of userSequences) {
    if (now - sequence.timestamp <= SEQUENCE_WINDOW_MS) {
      active.push({
        userId: sequence.userId,
        combined: sequence.combined,
        messageCount: sequence.messages.length,
      });
    }
  }

  return active;
}

/**
 * Cleanup old sequences periodically
 */
export function cleanupOldSequences(): void {
  const now = Date.now();
  const keysToDelete: string[] = [];

  for (const [key, sequence] of userSequences) {
    if (now - sequence.timestamp > SEQUENCE_WINDOW_MS) {
      keysToDelete.push(key);
    }
  }

  for (const key of keysToDelete) {
    userSequences.delete(key);
  }
}

