/**
 * Cleanup scheduler - Centralizes all periodic cleanup tasks
 * Manages intervals for cleaning up expired data, old records, etc.
 */

import { cleanupOldSequences } from '../handlers/sequenceDetector.js';
import { cleanupOldInfractions } from '../handlers/automodInfractions.js';
import { cleanupMessageTracking } from '../handlers/automodRules.js';

/**
 * Active cleanup interval IDs for proper shutdown
 */
const cleanupIntervals: NodeJS.Timeout[] = [];

/**
 * Start all periodic cleanup tasks
 * Call this once when the bot is ready
 */
export function startAllCleanupTasks(): void {
  console.log('🧹 Starting cleanup tasks...');
  
  // Cleanup sequence detector every 30 seconds
  const sequenceCleanup = setInterval(() => {
    try {
      cleanupOldSequences();
    } catch (error) {
      console.error('Error cleaning up sequences:', error);
    }
  }, 30000);
  cleanupIntervals.push(sequenceCleanup);
  
  // Clean up old automod infractions every hour
  const infractionCleanup = setInterval(() => {
    try {
      cleanupOldInfractions();
    } catch (error) {
      console.error('Error cleaning up old infractions:', error);
    }
  }, 60 * 60 * 1000);
  cleanupIntervals.push(infractionCleanup);
  
  // Clean up message tracking for spam detection every 5 minutes
  const messageTrackingCleanup = setInterval(() => {
    try {
      cleanupMessageTracking();
    } catch (error) {
      console.error('Error cleaning up message tracking:', error);
    }
  }, 5 * 60 * 1000);
  cleanupIntervals.push(messageTrackingCleanup);
  
  console.log(`✓ Started ${cleanupIntervals.length} cleanup tasks`);
}

/**
 * Stop all cleanup tasks
 * Call this during graceful shutdown
 */
export function stopAllCleanupTasks(): void {
  console.log('🛑 Stopping cleanup tasks...');
  
  for (const interval of cleanupIntervals) {
    clearInterval(interval);
  }
  
  cleanupIntervals.length = 0;
  console.log('✓ All cleanup tasks stopped');
}

