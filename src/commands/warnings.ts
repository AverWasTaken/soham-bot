/**
 * Warnings command - View all warnings for a user
 * Usage: v!warnings @user or v!warnings [user_id]
 * 
 * Restricted to moderators only
 */

import { EmbedBuilder } from 'discord.js';
import { getPrefix } from '../config.js';
import { isModerator } from '../handlers/permissions.js';
import { getCasesByUser } from '../handlers/casesDb.js';

export default {
  name: 'warnings',
  aliases: ['warns'],
  description: 'View all warnings for a user (Mod only)',
  cooldownSeconds: 3,

  /**
   * Execute the warnings command
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

    // Validate arguments
    if (args.length === 0) {
      const prefix = getPrefix();
      await message.reply(
        `**Usage:** \`${prefix}warnings @user\` or \`${prefix}warnings [user_id]\`\n` +
        `**Example:** \`${prefix}warnings @User\` or \`${prefix}warnings 123456789012345678\``
      );
      return;
    }

    try {
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

      // Get all cases for this user in this guild
      const allCases = getCasesByUser(userId, message.guild.id);
      
      // Filter to only warnings
      const warnings = allCases.filter(c => c.type === 'WARN');

      if (warnings.length === 0) {
        await message.reply(`⚠️ No warnings found for **${userTag}** in this server.`);
        return;
      }

      // Create embeds (max 10 warnings per embed)
      const embeds: EmbedBuilder[] = [];
      for (let i = 0; i < warnings.length; i += 10) {
        const chunk = warnings.slice(i, i + 10);
        const embed = new EmbedBuilder()
          .setColor(0xFFFF00)
          .setTitle(`Warnings: ${userTag}`)
          .setDescription(
            `Showing ${i + 1}-${Math.min(i + chunk.length, warnings.length)} of ${warnings.length} warning${warnings.length !== 1 ? 's' : ''}\n` +
            `User ID: \`${userId}\``
          )
          .setTimestamp();

        for (const warning of chunk) {
          const timestamp = `<t:${Math.floor(warning.timestamp / 1000)}:R>`;
          
          let value = `**Moderator:** ${warning.moderatorTag}\n`;
          value += `**Reason:** ${warning.reason}\n`;
          value += `**Date:** ${timestamp}`;

          embed.addFields({
            name: `Case ${warning.caseId}`,
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
      console.error('Error executing warnings command:', error);
      await message.reply('❌ An error occurred while retrieving warnings.');
    }
  },
};

