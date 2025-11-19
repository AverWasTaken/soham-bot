/**
 * Conversation Manager - Handles cleanup of old conversations
 * Automatically removes conversations older than 7 days
 */

import { getAllConversations, deleteConversation } from './conversationDb.js';

const CONVERSATION_TTL = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
let cleanupInterval: NodeJS.Timeout | null = null;

/**
 * Start the conversation cleanup task
 * Runs every hour to clean up old conversations
 */
export function startConversationCleanup(): void {
  if (cleanupInterval) return; // Already running

  console.log('✓ Starting conversation cleanup task (runs every hour)');

  // Run cleanup immediately
  performCleanup();

  // Then run every hour
  cleanupInterval = setInterval(() => {
    performCleanup();
  }, 60 * 60 * 1000); // 1 hour
}

/**
 * Stop the conversation cleanup task
 */
export function stopConversationCleanup(): void {
  if (cleanupInterval) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
    console.log('✓ Stopped conversation cleanup task');
  }
}

/**
 * Perform the actual cleanup
 */
function performCleanup(): void {
  try {
    const now = Date.now();
    const conversations = getAllConversations();
    let deletedCount = 0;

    for (const conv of conversations) {
      const age = now - conv.updatedAt;
      if (age > CONVERSATION_TTL) {
        deleteConversation(conv.userId);
        deletedCount++;
      }
    }

    if (deletedCount > 0) {
      console.log(`✓ Cleaned up ${deletedCount} old conversations`);
    }
  } catch (error) {
    console.error('Error during conversation cleanup:', error);
  }
}

