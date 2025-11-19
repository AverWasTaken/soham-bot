/**
 * Caseinfo command - View details of a specific moderation case
 * Usage: v!caseinfo [case_id]
 * 
 * Restricted to moderators only
 */

import { EmbedBuilder } from 'discord.js';
import { getPrefix } from '../config.js';
import { isModerator } from '../handlers/permissions.js';
import { getCase } from '../handlers/casesDb.js';

const AUTHORIZED_USER_IDS = ['932320320222822400', '685580500596686967', '1407154399783948389'];

export default {
  name: 'caseinfo',
  aliases: ['case', 'viewcase'],
  description: 'View information about a moderation case (Mod only)',

  /**
   * Execute the caseinfo command
   * @param message - The message that triggered the command
   * @param args - Command arguments (case_id)
   */
  async execute(message: any, args: string[]) {
    // Check if user has moderator permissions
    if (!AUTHORIZED_USER_IDS.includes(message.author.id) && !isModerator(message.member)) {
      await message.reply('❌ You do not have permission to use this command.');
      return;
    }

    // Validate arguments
    if (args.length === 0) {
      const prefix = getPrefix();
      await message.reply(
        `**Usage:** \`${prefix}caseinfo [case_id]\`\n` +
        `**Example:** \`${prefix}caseinfo XfgTy\``
      );
      return;
    }

    const caseId = args[0];

    try {
      // Get case from database
      const caseData = getCase(caseId);

      if (!caseData) {
        await message.reply(`❌ Case \`${caseId}\` not found.`);
        return;
      }

      // Create embed with case information
      const embed = new EmbedBuilder()
        .setColor(getCaseColor(caseData.type))
        .setTitle(`Case ${caseData.caseId}`)
        .addFields(
          { name: 'Type', value: caseData.type, inline: true },
          { name: 'Target', value: `${caseData.targetTag}\n(\`${caseData.targetId}\`)`, inline: true },
          { name: 'Moderator', value: `${caseData.moderatorTag}\n(\`${caseData.moderatorId}\`)`, inline: true },
          { name: 'Reason', value: caseData.reason, inline: false }
        )
        .setFooter({ text: `Guild: ${caseData.guildName}` })
        .setTimestamp(caseData.timestamp);

      // Add duration field if applicable (for mutes)
      if (caseData.duration) {
        embed.addFields({ name: 'Duration', value: caseData.duration, inline: true });
      }

      // Add proof field if available
      if (caseData.proof) {
        embed.addFields({ name: 'Proof', value: caseData.proof, inline: false });
      }

      await message.reply({ embeds: [embed] });
    } catch (error) {
      console.error('Error executing caseinfo command:', error);
      await message.reply('❌ An error occurred while retrieving the case.');
    }
  },
};

/**
 * Get the color for a case type
 */
function getCaseColor(type: string): number {
  switch (type) {
    case 'BAN':
      return 0xFF0000;
    case 'KICK':
      return 0xFF6600;
    case 'MUTE':
      return 0xFFA500;
    case 'UNMUTE':
      return 0x00FF00;
    case 'WARN':
      return 0xFFFF00;
    default:
      return 0x0099FF;
  }
}


