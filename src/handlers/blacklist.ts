/**
 * Blacklist handler - Manages blacklisted links and content
 * Stores patterns in a JSON file for persistence
 */

import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const BLACKLIST_FILE = join(__dirname, '..', '..', 'blacklist.json');

interface BlacklistPattern {
  pattern: string;
  type: string;
  addedBy: string;
  addedAt: number;
}

/**
 * Initialize blacklist file if it doesn't exist
 */
function initializeBlacklistFile(): void {
  if (!existsSync(BLACKLIST_FILE)) {
    writeFileSync(BLACKLIST_FILE, JSON.stringify([], null, 2));
  }
}

/**
 * Load all blacklist patterns from file
 */
export function getBlacklistPatterns(): BlacklistPattern[] {
  try {
    initializeBlacklistFile();
    const data = readFileSync(BLACKLIST_FILE, 'utf-8');
    return JSON.parse(data) as BlacklistPattern[];
  } catch (error) {
    console.error('Error reading blacklist patterns:', error);
    return [];
  }
}

/**
 * Convert blacklist patterns to regex patterns
 */
export function getBlacklistRegexPatterns(): RegExp[] {
  const patterns = getBlacklistPatterns();
  return patterns.map(p => new RegExp(p.pattern, 'gi'));
}

/**
 * Check if content matches any blacklist pattern
 */
export function checkBlacklist(content: string, url?: string): { flagged: boolean; reason?: string } {
  const patterns = getBlacklistPatterns();
  const checkContent = `${content} ${url || ''}`.toLowerCase();

  for (const bl of patterns) {
    try {
      // For Discord URLs, use simple string matching
      if (bl.type === 'link' || bl.type === 'gif_image' || bl.type === 'attachment') {
        // Check if it's a Discord file path (no regex special chars like \.)
        if (!bl.pattern.includes('\\') && !bl.pattern.includes('.*')) {
          if (checkContent.includes(bl.pattern.toLowerCase())) {
            return {
              flagged: true,
              reason: `Blacklisted ${bl.type}: ${bl.pattern}`,
            };
          }
          continue; // Skip regex check for this pattern
        }
      }

      // For other patterns or regex patterns, use regex matching
      const regex = new RegExp(bl.pattern, 'gi');
      if (regex.test(checkContent)) {
        return {
          flagged: true,
          reason: `Blacklisted ${bl.type}: ${bl.pattern}`,
        };
      }
    } catch (error) {
      console.error('Error testing blacklist pattern:', error);
    }
  }

  return { flagged: false };
}

/**
 * Add a new blacklist pattern
 * @param pattern - The pattern string (can be regex or plain string)
 * @param type - Type of blacklist (link, gif, attachment, etc)
 * @param userId - ID of the user who added it
 * @returns Whether the pattern was added successfully
 */
export function addBlacklistPattern(pattern: string, type: string, userId: string): boolean {
  try {
    initializeBlacklistFile();
    const patterns = getBlacklistPatterns();

    // For Discord file paths, skip regex validation (simple string matching)
    const isSimpleString = !pattern.includes('\\') && !pattern.includes('.*') && !pattern.includes('|');
    
    // Validate regex pattern only if it looks like regex
    if (!isSimpleString) {
      try {
        new RegExp(pattern, 'gi');
      } catch (error) {
        throw new Error('Invalid regex pattern');
      }
    }

    // Check if pattern already exists
    if (patterns.some(p => p.pattern === pattern)) {
      throw new Error('Pattern already exists');
    }

    patterns.push({
      pattern,
      type,
      addedBy: userId,
      addedAt: Date.now(),
    });

    writeFileSync(BLACKLIST_FILE, JSON.stringify(patterns, null, 2));
    return true;
  } catch (error) {
    console.error('Error adding blacklist pattern:', error);
    throw error;
  }
}

/**
 * Remove a blacklist pattern
 * @param pattern - The regex pattern string to remove
 * @returns Whether the pattern was removed successfully
 */
export function removeBlacklistPattern(pattern: string): boolean {
  try {
    initializeBlacklistFile();
    const patterns = getBlacklistPatterns();
    const filtered = patterns.filter(p => p.pattern !== pattern);

    if (filtered.length === patterns.length) {
      throw new Error('Pattern not found');
    }

    writeFileSync(BLACKLIST_FILE, JSON.stringify(filtered, null, 2));
    return true;
  } catch (error) {
    console.error('Error removing blacklist pattern:', error);
    throw error;
  }
}

/**
 * Get all blacklist patterns with metadata
 */
export function getPatternsList(): BlacklistPattern[] {
  return getBlacklistPatterns();
}

