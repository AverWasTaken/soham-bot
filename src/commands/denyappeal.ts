/**
 * Deny Appeal command - Deny a user's appeal
 * Usage: v!denyappeal <appealId> [reason]
 * 
 * Restricted to specific staff roles only
 */

import { EmbedBuilder, Message } from 'discord.js';
import { getAppeal, updateAppealStatus, AppealStatus } from '../handlers/appealsDb.js';
import { requireGuild, handleCommandError } from '../utils/commandUtils.js';
import { getPrefix } from '../config.js';

// Role IDs that can accept/deny appeals
const ALLOWED_ROLE_IDS = [
  '1413096630777020456',
  '1414858050631766049',
  '1413096128223645766',
];

/**
 * Check if user has permission to manage appeals
 * @param message - The message to check
 * @returns True if user has permission
 */
async function canManageAppeals(message: Message): Promise<boolean> {
  if (!message.guild || !message.member) return false;

  // Check if user has any of the allowed roles
  const hasRole = message.member.roles.cache.some(role => 
    ALLOWED_ROLE_IDS.includes(role.id)
  );

  if (!hasRole) {
    await message.reply('❌ You do not have permission to manage appeals. Only specific staff roles can accept or deny appeals.');
    return false;
  }

  return true;
}

export default {
  name: 'denyappeal',
  aliases: ['deny-appeal', 'rejectappeal'],
  description: 'Deny a user\'s appeal (Staff only)',

  /**
   * Execute the deny appeal command
   * @param message - The message that triggered the command
   * @param args - Command arguments (appealId and optional reason)
   */
  async execute(message: Message, args: string[]) {
    // Must be in a guild
    if (!(await requireGuild(message))) return;

    // Check permissions
    if (!(await canManageAppeals(message))) return;

    // Validate arguments
    if (args.length === 0) {
      const prefix = getPrefix();
      await message.reply(
        `**Usage:** \`${prefix}denyappeal <appealId> [reason]\`\n` +
        `**Example:** \`${prefix}denyappeal APL-XYZ12 Appeal lacks sufficient justification\``
      );
      return;
    }

    try {
      const appealId = args[0].toUpperCase();
      const reason = args.slice(1).join(' ') || 'No reason provided';

      // Get the appeal
      const appeal = getAppeal(appealId);

      if (!appeal) {
        await message.reply(`❌ Appeal \`${appealId}\` not found. Please check the appeal ID and try again.`);
        return;
      }

      // Check if appeal is already processed
      if (appeal.status !== AppealStatus.PENDING) {
        await message.reply(
          `❌ This appeal has already been processed.\n` +
          `**Status:** ${appeal.status}\n` +
          `**Reviewed by:** ${appeal.reviewerTag || 'Unknown'}\n` +
          `**Review date:** <t:${Math.floor((appeal.reviewedAt || 0) / 1000)}:F>`
        );
        return;
      }

      // Update appeal status
      const success = updateAppealStatus(
        appealId,
        AppealStatus.DENIED,
        message.author.id,
        message.author.tag,
        reason
      );

      if (!success) {
        await message.reply('❌ Failed to update appeal status. Please try again.');
        return;
      }

      // Send confirmation to staff
      const staffEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('Appeal Denied')
        .addFields(
          { name: 'Appeal ID', value: `\`${appealId}\``, inline: true },
          { name: 'User', value: `<@${appeal.userId}> (${appeal.userTag})`, inline: true },
          { name: 'Reviewed By', value: message.author.tag, inline: true },
          { name: 'Punishment Type', value: appeal.punishmentType, inline: true },
          { name: 'Original Reason', value: appeal.punishmentReason, inline: false },
          { name: 'Denial Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await message.reply({ embeds: [staffEmbed] });

      // Notify the user
      try {
        const user = await message.client.users.fetch(appeal.userId);
        
        const userEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('Appeal Denied')
          .setDescription(`Your appeal for **${appeal.guildName}** has been denied by the staff team.`)
          .addFields(
            { name: 'Appeal ID', value: appealId, inline: true },
            { name: 'Punishment Type', value: appeal.punishmentType, inline: true },
            { name: 'Status', value: 'Denied', inline: true },
            { name: 'Reason for Denial', value: reason, inline: false }
          )
          .setFooter({ text: 'If you believe this was a mistake, you may contact a server administrator.' })
          .setTimestamp();

        await user.send({ embeds: [userEmbed] });
        
        if (message.channel && 'send' in message.channel) {
          await message.channel.send(`✅ User <@${appeal.userId}> has been notified of the decision.`);
        }
      } catch (error) {
        if (message.channel && 'send' in message.channel) {
          await message.channel.send(`⚠️ Could not send DM to user. They may have DMs disabled.`);
        }
      }

      console.log(
        `✓ Appeal denied: ${appealId} by ${message.author.tag} | User: ${appeal.userTag}`
      );
    } catch (error: any) {
      await handleCommandError(error, message, 'denyappeal');
    }
  },
};

