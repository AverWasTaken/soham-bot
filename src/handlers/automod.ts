/**
 * Automod handler - Filters and flags inappropriate content
 * Combines regex-based detection with AI flagging and learned patterns
 */


// Regex patterns for common slur bypasses and inappropriate content
const SLUR_PATTERNS = [
  // Common racist slur variations
  /\bn[i1!@]g+[a3@]s?\b/gi,
  /\bn[i1!@]gg[a3@]\b/gi,
  /\bn[i1!@]gg[e3@]r\b/gi,
  /\bnig+([a3@]|ah)\b/gi,
  
  // Other racial slurs and variations
  /\bsp[i1!@]c+[k]\b/gi,
  /\bch[i1!@]nk+\b/gi,
  /\bk[o0]on\b/gi,
  /\br[a@]gg?head\b/gi,
  /\bcr[a@]ck[e3@]r\b/gi,
  /\bh[o0]nk[y1!@]?\b/gi,
];


/**
 * Check if a message contains problematic content using regex patterns
 * @param content - The message content to check
 * @returns Object with flag status and reason
 */
function checkRegexPatterns(content: string): { flagged: boolean; reason?: string } {
  // Check built-in patterns (all patterns use 'gi' flag for case-insensitive matching)
  for (const pattern of SLUR_PATTERNS) {
    if (pattern.test(content)) {
      return {
        flagged: true,
        reason: 'Detected potentially inappropriate content',
      };
    }
  }
  
  return { flagged: false };
}

/**
 * Perform full automod check on a message
 * Uses regex patterns to catch slurs and learned bypasses
 * @param content - The message content to check
 * @returns Object with flag status and reason
 */
export async function checkMessage(content: string): Promise<{ flagged: boolean; reason?: string }> {
  // Check regex patterns (fast, reliable) - catches slurs and learned bypasses
  const regexResult = checkRegexPatterns(content);
  if (regexResult.flagged) {
    return regexResult;
  }

  // Don't use AI for general moderation - allows swearing
  // Only regex patterns (slurs, learned bypasses) are flagged
  
  return { flagged: false };
}

/**
 * Export patterns for testing/debugging
 */
export { SLUR_PATTERNS };

