/**
 * Clearcases command - Delete all moderation cases for a specific user
 * Usage: v!clearcases @user or v!clearcases [user_id]
 * 
 * Restricted to full moderators only
 */

import { EmbedBuilder } from 'discord.js';
import { getPrefix } from '../config.js';
import { isSeniorModerator } from '../handlers/permissions.js';
import { getCasesByUser, deleteAllCasesForUser } from '../handlers/casesDb.js';

export default {
  name: 'clearcases',
  aliases: ['clearhistory', 'wipecases'],
  description: 'Delete all moderation cases for a user (Mod only)',

  /**
   * Execute the clearcases command
   * @param message - The message that triggered the command
   * @param args - Command arguments (user mention/id)
   */
  async execute(message: any, args: string[]) {
    // Check if user has senior moderator permissions (only senior mods/admins can clear all cases)
    if (!isSeniorModerator(message.member)) {
      await message.reply('❌ You do not have permission to use this command. Clearing cases requires senior moderator permissions.');
      return;
    }

    // Check if command is used in a guild
    if (!message.guild) {
      await message.reply('❌ This command can only be used in a server.');
      return;
    }

    // Validate arguments
    if (args.length === 0) {
      await message.reply(
        `**Usage:** \`${getPrefix()}clearcases @user\` or \`${getPrefix()}clearcases [user_id]\`\n` +
        `**Example:** \`${getPrefix()}clearcases @User#1234\`\n\n` +
        `**Warning:** This will delete ALL cases for the specified user in this server.`
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

      // Get cases count before deletion
      const cases = getCasesByUser(userId, message.guild.id);

      if (cases.length === 0) {
        await message.reply(`📋 No moderation cases found for **${userTag}** in this server.`);
        return;
      }

      // Delete all cases for this user in this guild
      const deletedCount = deleteAllCasesForUser(userId, message.guild.id);

      // Send confirmation embed
      const embed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('Cases Cleared')
        .setDescription(`All moderation cases for **${userTag}** have been deleted.`)
        .addFields(
          { name: 'User ID', value: userId, inline: true },
          { name: 'Cases Deleted', value: deletedCount.toString(), inline: true },
          { name: 'Cleared By', value: message.author.tag, inline: false }
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });

      console.log(
        `✓ Cases Cleared: ${message.author.tag} deleted ${deletedCount} case${deletedCount !== 1 ? 's' : ''} for ${userTag} (${userId})`
      );
    } catch (error) {
      console.error('Error executing clearcases command:', error);
      await message.reply('❌ An error occurred while clearing cases.');
    }
  },
};

