/**
 * AutoMod Clear command - Clear automod infractions for a user
 * Usage: v!amclear @user
 * 
 * Clears all automod infractions for a specific user
 * Restricted to moderators only
 */

import { EmbedBuilder, Message } from 'discord.js';
import {
  parseUserInput,
  requireGuild,
  requireModerator,
} from '../utils/commandUtils.js';
import { getPrefix } from '../config.js';
import {
  clearUserInfractions,
  getRecentInfractionCount,
  getUserInfractions,
} from '../handlers/automodInfractions.js';

export default {
  name: 'amclear',
  aliases: ['clearinfractions', 'clearautomod'],
  description: 'Clear automod infractions for a user (Mod only)',

  /**
   * Execute the amclear command
   * @param message - The message that triggered the command
   * @param args - Command arguments (user mention/id)
   */
  async execute(message: Message, args: string[]) {
    // Check if user has moderator permissions
    if (!(await requireModerator(message))) return;

    // Check if command is used in a guild
    if (!(await requireGuild(message))) return;

    // Validate arguments
    if (args.length < 1) {
      const prefix = getPrefix();
      await message.reply(
        `**Usage:** \`${prefix}amclear @user\`\n` +
        `**Example:** \`${prefix}amclear @User\` or \`${prefix}amclear 123456789012345678\``
      );
      return;
    }

    try {
      // Parse user mention or ID
      const userId = parseUserInput(args[0]);

      if (!userId) {
        await message.reply('❌ Invalid user mention or ID. Please mention a user or provide their ID.');
        return;
      }

      // Get current infraction count before clearing
      const currentCount = getRecentInfractionCount(userId, message.guild!.id);
      const allInfractions = getUserInfractions(userId, message.guild!.id);

      if (currentCount === 0) {
        await message.reply(`ℹ️ User <@${userId}> has no active automod infractions.`);
        return;
      }

      // Clear infractions
      const clearedCount = clearUserInfractions(userId, message.guild!.id);

      // Try to fetch the user for display
      let userTag = userId;
      try {
        const user = await message.client.users.fetch(userId);
        userTag = user.tag;
      } catch {
        // User not found, use ID
      }

      // Send confirmation embed
      const confirmEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('🧹 Automod Infractions Cleared')
        .addFields(
          { name: 'User', value: `${userTag} (${userId})`, inline: true },
          { name: 'Moderator', value: message.author.tag, inline: true },
          { name: 'Infractions Cleared', value: clearedCount.toString(), inline: true }
        )
        .setDescription(
          `All automod infractions have been cleared for this user.\n` +
          `They will start fresh with no punishment history.`
        )
        .setTimestamp();

      await message.reply({ embeds: [confirmEmbed] });

      console.log(
        `✓ Automod Clear: ${message.author.tag} cleared ${clearedCount} infractions for ${userTag} (${userId})`
      );
    } catch (error: any) {
      console.error('Error executing amclear command:', error);
      await message.reply(`❌ An error occurred: ${error.message}`);
    }
  },
};

