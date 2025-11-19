/**
 * OpenRouter AI Integration - Send messages to AI model via OpenRouter API
 * Handles API requests and streaming responses
 */

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;
const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';
const MODEL = 'openai/gpt-oss-120b'; // Using Llama 2 as default

/**
 * Send a message to the AI and get a response
 * @param messages - Array of messages in conversation format
 * @param systemPrompt - System prompt for the AI
 * @returns The AI's response text
 */
export async function sendAIMessage(
  messages: Array<{ role: string; content: string; timestamp: number }>,
  systemPrompt: string
): Promise<string> {
  if (!OPENROUTER_API_KEY) {
    throw new Error('OPENROUTER_API_KEY not configured');
  }

  try {
    // Convert messages to OpenRouter format (remove timestamp)
    const formattedMessages = messages.map(msg => ({
      role: msg.role,
      content: msg.content,
    }));

    const response = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://discord.com',
        'X-Title': 'Soham Moderation Bot',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: MODEL,
        messages: [
          {
            role: 'system',
            content: systemPrompt,
          },
          ...formattedMessages,
        ],
        temperature: 0.7,
        max_tokens: 1024,
      }),
    });

    if (!response.ok) {
      const error = await response.json() as { error?: { message?: string } };
      throw new Error(`OpenRouter API error: ${error.error?.message || response.statusText}`);
    }

    const data = await response.json() as { choices?: Array<{ message?: { content?: string } }> };

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid response format from OpenRouter');
    }

    return data.choices[0].message.content?.trim() || '';
  } catch (error) {
    console.error('Error calling OpenRouter API:', error);
    throw error;
  }
}

/**
 * Check if OpenRouter API is configured
 */
export function isOpenRouterConfigured(): boolean {
  return !!OPENROUTER_API_KEY;
}

