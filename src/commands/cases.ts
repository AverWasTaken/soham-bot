/**
 * Cases command - View all moderation cases for a user
 * Usage: v!cases @user or v!cases [user_id]
 * 
 * Restricted to moderators only
 */

import { EmbedBuilder } from 'discord.js';
import { isModerator } from '../handlers/permissions.js';
import { getCasesByUser, getCaseCount, getRecentCases } from '../handlers/casesDb.js';

export default {
  name: 'cases',
  aliases: ['history', 'modlog'],
  description: 'View moderation history for a user (Mod only)',

  /**
   * Execute the cases command
   * @param message - The message that triggered the command
   * @param args - Command arguments (user mention/id)
   */
  async execute(message: any, args: string[]) {
    // Check if user has moderator permissions
    if (!isModerator(message.member)) {
      await message.reply('❌ You do not have permission to use this command.');
      return;
    }

    // Check if command is used in a guild
    if (!message.guild) {
      await message.reply('❌ This command can only be used in a server.');
      return;
    }

    try {
      // If no arguments, show 10 recent cases in the guild
      if (args.length === 0) {
        const recentCases = getRecentCases(10, message.guild.id);

        if (recentCases.length === 0) {
          await message.reply('📋 No moderation cases found in this server.');
          return;
        }

        const embed = new EmbedBuilder()
          .setColor(0x0099FF)
          .setTitle('Recent Moderation Cases')
          .setDescription(`Showing ${recentCases.length} most recent case${recentCases.length !== 1 ? 's' : ''}`);

        for (const caseData of recentCases) {
          const timestamp = `<t:${Math.floor(caseData.timestamp / 1000)}:R>`;
          
          let value = `**Type:** ${caseData.type}\n`;
          value += `**Target:** ${caseData.targetTag}\n`;
          value += `**Moderator:** ${caseData.moderatorTag}\n`;
          value += `**Reason:** ${caseData.reason}\n`;
          if (caseData.duration) {
            value += `**Duration:** ${caseData.duration}\n`;
          }
          value += `**Date:** ${timestamp}`;

          embed.addFields({
            name: `Case ${caseData.caseId}`,
            value,
            inline: false,
          });
        }

        embed.setTimestamp();
        await message.reply({ embeds: [embed] });
        return;
      }

      // Parse user mention or ID
      const userInput = args[0];
      let userId: string;
      let userTag = 'Unknown User';

      // Check if it's a mention
      const mentionMatch = userInput.match(/^<@!?(\d+)>$/);
      if (mentionMatch) {
        userId = mentionMatch[1];
      } else if (/^\d{17,19}$/.test(userInput)) {
        // Direct user ID
        userId = userInput;
      } else {
        await message.reply('❌ Invalid user mention or ID. Please mention a user or provide their ID.');
        return;
      }

      // Try to fetch user to get their tag
      try {
        const user = await message.client.users.fetch(userId);
        userTag = user.tag;
      } catch {
        // User not found, use ID as fallback
        userTag = `User ${userId}`;
      }

      // Get cases for this user in this guild
      const cases = getCasesByUser(userId, message.guild.id);
      const totalCases = getCaseCount(userId, message.guild.id);

      if (cases.length === 0) {
        await message.reply(`📋 No moderation cases found for **${userTag}** in this server.`);
        return;
      }

      // Create embeds (max 10 cases per embed)
      const embeds: EmbedBuilder[] = [];
      for (let i = 0; i < cases.length; i += 10) {
        const chunk = cases.slice(i, i + 10);
        const embed = new EmbedBuilder()
          .setColor(0x0099FF)
          .setTitle(`Moderation History: ${userTag}`)
          .setDescription(
            `Showing ${i + 1}-${Math.min(i + chunk.length, cases.length)} of ${totalCases} case${totalCases !== 1 ? 's' : ''}\n` +
            `User ID: \`${userId}\``
          )
          .setTimestamp();

        for (const caseData of chunk) {
          const timestamp = `<t:${Math.floor(caseData.timestamp / 1000)}:R>`;
          
          let value = `**Type:** ${caseData.type}\n`;
          value += `**Moderator:** ${caseData.moderatorTag}\n`;
          value += `**Reason:** ${caseData.reason}\n`;
          if (caseData.duration) {
            value += `**Duration:** ${caseData.duration}\n`;
          }
          value += `**Date:** ${timestamp}`;

          embed.addFields({
            name: `Case ${caseData.caseId}`,
            value,
            inline: false,
          });
        }

        embeds.push(embed);
      }

      // Send first embed as reply
      await message.reply({ embeds: [embeds[0]] });

      // Send additional embeds if needed
      for (let i = 1; i < embeds.length; i++) {
        await message.channel.send({ embeds: [embeds[i]] });
      }
    } catch (error) {
      console.error('Error executing cases command:', error);
      await message.reply('❌ An error occurred while retrieving cases.');
    }
  },
};


