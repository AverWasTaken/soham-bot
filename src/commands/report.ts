/**
 * Report command - report a message
 * Usage: Reply to a message with v!report
 * 
 * Features:
 * - Reports messages to a designated channel
 * - Includes reported message content and author
 * - Includes reporter information
 * - Rate limited to once per hour per user
 */

import { EmbedBuilder } from 'discord.js';
import type { DiscordCommand } from '../types/command.js';

const REPORT_CHANNEL_ID = '1435843660263718923';


const command: DiscordCommand = {
  name: 'report',
  description: 'Report a message by replying to it with v!report',
  cooldownSeconds: 3600,

  /**
   * Execute the report command
   * @param message - The message that triggered the command
   */
  async execute(message: any) {
    try {
      // Check if this is a reply to another message
      if (!message.reference) {
        const { getPrefix } = await import('../config.js');
        const prefix = getPrefix();
        await message.reply(`❌ You must reply to a message to report it. Usage: Reply to a message with \`${prefix}report\``);
        return;
      }

      // Fetch the reported message
      let reportedMessage;
      try {
        reportedMessage = await message.fetchReference();
      } catch (error) {
        console.error('Error fetching reported message:', error);
        await message.reply('❌ Could not fetch the message you are trying to report.');
        return;
      }

      // Get the report channel
      let reportChannel;
      try {
        reportChannel = await message.client.channels.fetch(REPORT_CHANNEL_ID);
      } catch (error) {
        console.error('Error fetching report channel:', error);
        await message.reply('❌ Report channel not found. Please contact an administrator.');
        return;
      }

      if (!reportChannel) {
        await message.reply('❌ Report channel not found. Please contact an administrator.');
        return;
      }

      // Create embed with report details
      const reportEmbed = new EmbedBuilder()
        .setColor(0xFF0000) // Red color for reports
        .setTitle('Message Reported')
        .addFields(
          {
            name: 'Reported By',
            value: `${message.author.tag} (${message.author.id})`,
            inline: true,
          },
          {
            name: 'Message Author',
            value: `${reportedMessage.author.tag} (${reportedMessage.author.id})`,
            inline: true,
          },
          {
            name: 'Channel',
            value: `<#${reportedMessage.channel.id}>`,
            inline: true,
          },
          {
            name: 'Reported Message Content',
            value: reportedMessage.content || '*(No text content)*',
            inline: false,
          },
          {
            name: 'Message Link',
            value: `[Jump to message](${reportedMessage.url})`,
            inline: false,
          }
        )
        .setTimestamp()
        .setFooter({ text: 'Report System' });

      // Send report to the report channel
      await reportChannel.send({ embeds: [reportEmbed] });

      // Confirm to the user
      await message.reply('✅ Message reported successfully. Thank you for helping keep the server safe!');

      console.log(`Report: ${message.author.tag} reported a message from ${reportedMessage.author.tag} in #${reportedMessage.channel.name}`);
    } catch (error) {
      console.error('Error in report command:', error);
      await message.reply('❌ An error occurred while processing your report. Please try again later.');
    }
  },
};

export default command;

