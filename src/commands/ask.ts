/**
 * Ask Command - Ask the AI a question with conversation context
 * Usage: v!ask [question]
 * 
 * Features:
 * - Maintains conversation history for context
 * - Works in any channel
 * - React with ❌ to end conversation and clear history
 * - Can mention the bot or reply to continue conversation
 */

import { EmbedBuilder } from 'discord.js';
import { getPrefix } from '../config.js';
import { sendAIMessage, isOpenRouterConfigured } from '../handlers/openrouter.js';
import { storeConversation, getConversation } from '../handlers/conversationDb.js';

const AUTHORIZED_USER_IDS = ['932320320222822400', '685580500596686967', '1407154399783948389'];

const ASK_SYSTEM_PROMPT = `You are a helpful Discord bot assistant named RomulusPrime. You provide helpful, accurate, and concise answers to user questions. Keep responses brief and formatted for Discord (under 2000 characters). Be friendly and professional.`;

export default {
  name: 'ask',
  aliases: ['ai', 'question'],
  description: 'Ask the AI a question',
  exclusivePerUser: true,
  cooldownSeconds: 3,

  /**
   * Execute the ask command
   * @param message - The message that triggered the command
   * @param args - Command arguments (the question)
   */
  async execute(message: any, args: string[]) {
    if (!isOpenRouterConfigured()) {
      await message.reply('❌ AI service is not configured. Please set OPENROUTER_API_KEY in .env');
      return;
    }

    const question = args.join(' ').trim();

    if (!question) {
      const prefix = getPrefix();
      await message.reply(`❌ Please ask a question. Example: \`${prefix}ask What is TypeScript?\``);
      return;
    }

    try {
      // Show typing indicator
      await message.channel.sendTyping();

      // Get existing conversation for this user
      let conversation = getConversation(message.author.id);

      // Add the user's new question
      conversation.push({
        role: 'user',
        content: question,
        timestamp: Date.now(),
      });

      // Get AI response
      const response = await sendAIMessage(conversation, ASK_SYSTEM_PROMPT);

      // Add AI response to conversation
      conversation.push({
        role: 'assistant',
        content: response,
        timestamp: Date.now(),
      });

      // Store updated conversation
      storeConversation(message.author.id, conversation);

      // Create embed for response
      const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setAuthor({
          name: 'AI Assistant',
          iconURL: message.client.user.avatarURL() || undefined,
        })
        .setDescription(response)
        .setFooter({
          text: `React with ❌ to end this conversation | Asked by ${message.author.username}`,
        })
        .setTimestamp();

      // Send response
      const botMessage = await message.reply({
        embeds: [embed],
      });

      // Add ❌ reaction to allow user to end conversation
      try {
        await botMessage.react('❌');
      } catch (error) {
        console.error('Error adding reaction:', error);
      }
    } catch (error: any) {
      console.error('Error in ask command:', error);

      let errorMessage = '❌ An error occurred while processing your question.';
      if (error.message.includes('OPENROUTER_API_KEY')) {
        errorMessage = '❌ AI service is not properly configured.';
      } else if (error.message.includes('OpenRouter')) {
        errorMessage = '❌ Failed to reach AI service. Please try again later.';
      }

      await message.reply(errorMessage);
    }
  },
};

