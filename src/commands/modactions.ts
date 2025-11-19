/**
 * Modactions command - View moderator action statistics
 * Usage: v!modactions @user or v!modactions userID
 * 
 * Shows statistics and recent actions for a specific moderator
 * Restricted to specific authorized roles
 */

import { EmbedBuilder, Message } from 'discord.js';
import { parseUserInput, handleCommandError, requireGuild } from '../utils/commandUtils.js';
import { getModeratorStats, getModeratorRecentActions } from '../handlers/modActionsDb.js';
import { getPrefix } from '../config.js';

// Authorized role IDs that can use this command
const AUTHORIZED_ROLES = [
  '1413096630777020456',
  '1413096128223645766',
];

export default {
  name: 'modactions',
  aliases: ['modstats', 'modlogs'],
  description: 'View moderator action statistics (Restricted)',

  /**
   * Execute the modactions command
   * @param message - The message that triggered the command
   * @param args - Command arguments (user mention or ID)
   */
  async execute(message: Message, args: string[]) {
    // Check if command is used in a guild
    if (!(await requireGuild(message))) return;

    // Check if user has one of the authorized roles
    const member = message.member;
    if (!member) {
      await message.reply('❌ Could not verify your permissions.');
      return;
    }

    const hasAuthorizedRole = AUTHORIZED_ROLES.some(roleId => member.roles.cache.has(roleId));
    
    if (!hasAuthorizedRole) {
      await message.reply('❌ You do not have permission to use this command.');
      return;
    }

    // Validate arguments
    if (args.length === 0) {
      const prefix = getPrefix();
      await message.reply(
        `**Usage:** \`${prefix}modactions @user\` or \`${prefix}modactions userID\`\n` +
        `**Example:** \`${prefix}modactions @Moderator\` or \`${prefix}modactions 123456789012345678\``
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

      // Fetch the user
      const targetUser = await message.client.users.fetch(userId).catch(() => null);
      
      if (!targetUser) {
        await message.reply('❌ User not found.');
        return;
      }

      // Get moderator statistics (guild-specific)
      const stats = getModeratorStats(userId, message.guild!.id);

      if (!stats || stats.totalActions === 0) {
        const noActionsEmbed = new EmbedBuilder()
          .setColor(0x808080)
          .setTitle('Moderator Actions')
          .setDescription(`**${targetUser.tag}** has not taken any moderation actions in this server.`)
          .setTimestamp();

        await message.reply({ embeds: [noActionsEmbed] });
        return;
      }

      // Get recent actions (last 5)
      const recentActions = getModeratorRecentActions(userId, 5, message.guild!.id);

      // Build recent actions list
      let recentActionsText = '';
      if (recentActions.length > 0) {
        recentActionsText = recentActions
          .map(action => {
            const date = new Date(action.timestamp);
            return `**${action.actionType}** - ${action.targetTag}\n<t:${Math.floor(action.timestamp / 1000)}:R> • Case: ${action.caseId || 'N/A'}`;
          })
          .join('\n\n');
      } else {
        recentActionsText = 'No recent actions found.';
      }

      // Create statistics embed
      const statsEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Moderator Action Statistics')
        .setDescription(`Statistics for **${targetUser.tag}** in **${message.guild!.name}**`)
        .addFields(
          { 
            name: 'Total Actions', 
            value: `\`${stats.totalActions}\` actions`, 
            inline: true 
          },
          { 
            name: '\u200b', 
            value: '\u200b', 
            inline: true 
          },
          { 
            name: '\u200b', 
            value: '\u200b', 
            inline: true 
          },
          { 
            name: 'Warnings', 
            value: `\`${stats.warns}\``, 
            inline: true 
          },
          { 
            name: 'Mutes', 
            value: `\`${stats.mutes}\``, 
            inline: true 
          },
          { 
            name: 'Unmutes', 
            value: `\`${stats.unmutes}\``, 
            inline: true 
          },
          { 
            name: 'Kicks', 
            value: `\`${stats.kicks}\``, 
            inline: true 
          },
          { 
            name: 'Bans', 
            value: `\`${stats.bans}\``, 
            inline: true 
          },
          { 
            name: 'Unbans', 
            value: `\`${stats.unbans}\``, 
            inline: true 
          },
          { 
            name: 'Recent Actions', 
            value: recentActionsText, 
            inline: false 
          }
        )
        .setThumbnail(targetUser.displayAvatarURL({ size: 128 }))
        .setFooter({ text: `Moderator ID: ${userId}` })
        .setTimestamp();

      await message.reply({ embeds: [statsEmbed] });

      console.log(`✓ Modactions: ${message.author.tag} viewed stats for ${targetUser.tag} (${userId})`);
    } catch (error: any) {
      await handleCommandError(error, message, 'modactions');
    }
  },
};


