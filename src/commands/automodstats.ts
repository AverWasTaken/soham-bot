/**
 * Automodstats command - View automod infractions for a user
 * Usage: v!automodstats @user or v!automodstats [user_id]
 * 
 * Shows recent automod infractions and punishment history
 * Restricted to moderators only
 */

import { EmbedBuilder, Message } from 'discord.js';
import { isModerator } from '../handlers/permissions.js';
import { getUserInfractions, getRecentInfractionCount } from '../handlers/automodInfractions.js';
import { parseUserInput } from '../utils/commandUtils.js';
import { getPrefix } from '../config.js';

export default {
  name: 'automodstats',
  aliases: ['amstats', 'infractions', 'ams'],
  description: 'View automod infractions for a user (Mod only)',

  /**
   * Execute the automodstats command
   * @param message - The message that triggered the command
   * @param args - Command arguments (user mention/id)
   */
  async execute(message: Message, args: string[]) {
    // Check if user has moderator permissions
    if (!message.member || !isModerator(message.member)) {
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
        `**Usage:** \`${prefix}automodstats @user\` or \`${prefix}automodstats [user_id]\`\n` +
        `**Example:** \`${prefix}automodstats @User\` or \`${prefix}automodstats 123456789012345678\``
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

      // Try to fetch user to get their tag
      let userTag = 'Unknown User';
      try {
        const user = await message.client.users.fetch(userId);
        userTag = user.tag;
      } catch {
        // User not found, use ID as fallback
        userTag = `User ${userId}`;
      }

      // Get infractions for this user
      const infractions = getUserInfractions(userId, message.guild.id);
      const recentCount = getRecentInfractionCount(userId, message.guild.id);

      // Create embed
      const embed = new EmbedBuilder()
        .setColor(infractions.length > 0 ? 0xFF6600 : 0x00FF00)
        .setTitle(`⚖️ Automod Infractions - ${userTag}`)
        .setDescription(
          `**Active Infractions (7 days):** ${recentCount}\n` +
          `**Total Records:** ${infractions.length}`
        )
        .setFooter({ text: `User ID: ${userId} • Infractions expire after 7 days` })
        .setTimestamp();

      // Add infraction details if any exist
      if (infractions.length > 0) {
        // Get last 10 infractions
        const recentInfractions = infractions.slice(0, 10);
        
        let infractionText = '';
        for (const infraction of recentInfractions) {
          const date = new Date(infraction.timestamp);
          const timeStr = `<t:${Math.floor(date.getTime() / 1000)}:R>`;
          infractionText += `• **${infraction.type}** - ${infraction.punishmentApplied} ${timeStr}\n`;
        }

        embed.addFields({
          name: 'Recent Infractions',
          value: infractionText || 'None',
          inline: false,
        });

        if (infractions.length > 10) {
          embed.addFields({
            name: 'Note',
            value: `Showing 10 most recent infractions out of ${infractions.length} total.`,
            inline: false,
          });
        }
      } else {
        embed.addFields({
          name: 'Infractions',
          value: '✅ No automod infractions found for this user.',
          inline: false,
        });
      }

      await message.reply({ embeds: [embed] });
    } catch (error: any) {
      console.error('Error executing automodstats command:', error);
      await message.reply('❌ An error occurred while fetching automod statistics.');
    }
  },
};

