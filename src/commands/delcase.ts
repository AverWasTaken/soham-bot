/**
 * Delcase command - Delete a moderation case
 * Usage: v!delcase [case_id]
 * 
 * Restricted to moderators only
 */

import { EmbedBuilder } from 'discord.js';
import { getPrefix } from '../config.js';
import { isFullModerator } from '../handlers/permissions.js';
import { getCase, deleteCase } from '../handlers/casesDb.js';

const AUTHORIZED_USER_IDS = ['932320320222822400', '685580500596686967', '1407154399783948389'];

export default {
  name: 'delcase',
  aliases: ['deletecase', 'removecase'],
  description: 'Delete a moderation case (Mod only)',

  /**
   * Execute the delcase command
   * @param message - The message that triggered the command
   * @param args - Command arguments (case_id)
   */
  async execute(message: any, args: string[]) {
    // Check if user has full moderator permissions (trial mods cannot delete cases)
    // Allow authorized users regardless of role
    if (!AUTHORIZED_USER_IDS.includes(message.author.id) && !isFullModerator(message.member)) {
      await message.reply('❌ You do not have permission to use this command. Deleting cases requires full moderator permissions.');
      return;
    }

    // Validate arguments
    if (args.length === 0) {
      await message.reply(
        `**Usage:** \`${getPrefix()}delcase [case_id]\`\n` +
        `**Example:** \`${getPrefix()}delcase XfgTy\``
      );
      return;
    }

    const caseId = args[0];

    try {
      // Get case info first
      const caseData = getCase(caseId);

      if (!caseData) {
        await message.reply(`❌ Case \`${caseId}\` not found.`);
        return;
      }

      // Delete the case
      const deleted = deleteCase(caseId);

      if (!deleted) {
        await message.reply(`❌ Failed to delete case \`${caseId}\`.`);
        return;
      }

      // Send confirmation embed
      const embed = new EmbedBuilder()
        .setColor(0xFF6600)
        .setTitle('Case Deleted')
        .addFields(
          { name: 'Case ID', value: caseId, inline: true },
          { name: 'Type', value: caseData.type, inline: true },
          { name: 'Target', value: `${caseData.targetTag} (\`${caseData.targetId}\`)`, inline: false },
          { name: 'Deleted By', value: message.author.tag, inline: true }
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });

      console.log(
        `✓ Case Deleted: ${message.author.tag} deleted case ${caseId} (${caseData.type} for ${caseData.targetTag})`
      );
    } catch (error) {
      console.error('Error executing delcase command:', error);
      await message.reply('❌ An error occurred while deleting the case.');
    }
  },
};

