/**
 * Accept Appeal command - Accept a user's appeal
 * Usage: v!acceptappeal <appealId> [note]
 * 
 * Restricted to specific staff roles only
 */

import { EmbedBuilder, Message } from 'discord.js';
import { getAppeal, updateAppealStatus, AppealStatus } from '../handlers/appealsDb.js';
import { getCasesByUser, deleteCase } from '../handlers/casesDb.js';
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
  name: 'acceptappeal',
  aliases: ['accept-appeal', 'approveappeal'],
  description: 'Accept a user\'s appeal (Staff only)',

  /**
   * Execute the accept appeal command
   * @param message - The message that triggered the command
   * @param args - Command arguments (appealId and optional note)
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
        `**Usage:** \`${prefix}acceptappeal <appealId> [note]\`\n` +
        `**Example:** \`${prefix}acceptappeal APL-XYZ12 Sincere apology, giving second chance\``
      );
      return;
    }

    try {
      const appealId = args[0].toUpperCase();
      const note = args.slice(1).join(' ') || 'No additional notes provided';

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
        AppealStatus.ACCEPTED,
        message.author.id,
        message.author.tag,
        note
      );

      if (!success) {
        await message.reply('❌ Failed to update appeal status. Please try again.');
        return;
      }

      // Delete associated moderation cases
      const userCases = getCasesByUser(appeal.userId, appeal.guildId);
      const punishmentTypeMap: { [key: string]: string } = {
        'ban': 'BAN',
        'kick': 'KICK',
        'mute': 'MUTE',
        'warn': 'WARN',
      };
      
      let deletedCases = 0;
      const targetType = punishmentTypeMap[appeal.punishmentType.toLowerCase()];
      
      // Find and delete cases that match the punishment type and reason
      for (const caseData of userCases) {
        if (caseData.type === targetType && caseData.reason === appeal.punishmentReason) {
          if (deleteCase(caseData.caseId)) {
            deletedCases++;
          }
        }
      }

      // Send confirmation to staff
      const staffEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('Appeal Accepted')
        .addFields(
          { name: 'Appeal ID', value: `\`${appealId}\``, inline: true },
          { name: 'User', value: `<@${appeal.userId}> (${appeal.userTag})`, inline: true },
          { name: 'Reviewed By', value: message.author.tag, inline: true },
          { name: 'Punishment Type', value: appeal.punishmentType, inline: true },
          { name: 'Original Reason', value: appeal.punishmentReason, inline: false },
          { name: 'Staff Note', value: note, inline: false },
          { name: 'Cases Deleted', value: deletedCases > 0 ? `${deletedCases} case(s) removed` : 'No matching cases found', inline: false }
        )
        .setFooter({ text: 'Remember to take appropriate action (unban, unmute, etc.)' })
        .setTimestamp();

      await message.reply({ embeds: [staffEmbed] });

      // Notify the user
      try {
        const user = await message.client.users.fetch(appeal.userId);
        
        const userEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('Appeal Accepted')
          .setDescription(`Your appeal for **${appeal.guildName}** has been accepted by the staff team.`)
          .addFields(
            { name: 'Appeal ID', value: appealId, inline: true },
            { name: 'Punishment Type', value: appeal.punishmentType, inline: true },
            { name: 'Status', value: 'Accepted', inline: true },
            { name: 'Staff Note', value: note, inline: false }
          )
          .setFooter({ text: 'Thank you for your patience. Please continue to follow server rules.' })
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
        `✓ Appeal accepted: ${appealId} by ${message.author.tag} | User: ${appeal.userTag} | Deleted ${deletedCases} case(s)`
      );
    } catch (error: any) {
      await handleCommandError(error, message, 'acceptappeal');
    }
  },
};

