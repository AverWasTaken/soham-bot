/**
 * Setproof command - Attach proof to the most recent moderation case
 * Usage: v!setproof [proof_url]
 * 
 * Restricted to moderators only
 */

import { EmbedBuilder, Message } from 'discord.js';
import { isModerator } from '../handlers/permissions.js';
import { updateCaseProof, getCase } from '../handlers/casesDb.js';
import { getRecentCaseForModerator } from '../handlers/modLog.js';
import { getPrefix } from '../config.js';

export default {
  name: 'setproof',
  description: 'Attach proof to your most recent moderation case (Mod only)',

  /**
   * Execute the setproof command
   * @param message - The message that triggered the command
   * @param args - Command arguments (proof URL or text)
   */
  async execute(message: Message, args: string[]) {
    // Check if user has moderator permissions
    if (!isModerator(message.member)) {
      await message.reply('❌ You do not have permission to use this command.');
      return;
    }

    // Validate arguments
    if (args.length === 0) {
      const prefix = getPrefix();
      await message.reply(
        `**Usage:** \`${prefix}setproof [proof_url]\`\n` +
        `**Example:** \`${prefix}setproof https://imgur.com/a/abc123\`\n\n` +
        'This will attach the proof to your most recent moderation case.\n' +
        'You can run this command multiple times to add more proof.\n' +
        `To update a specific case, use \`${prefix}updateproof [case_id] [proof_url]\``
      );
      return;
    }

    try {
      const moderatorId = message.author.id;
      
      // Get the most recent case for this moderator
      const recentCaseId = getRecentCaseForModerator(moderatorId);
      
      if (!recentCaseId) {
        await message.reply(
          '❌ No recent case found. Please execute a moderation action (ban, kick, mute, warn) first.'
        );
        return;
      }

      // Get the proof (all arguments joined)
      const proof = args.join(' ');

      // Update the case with proof
      const updated = updateCaseProof(recentCaseId, proof);

      if (!updated) {
        await message.reply(`❌ Failed to update case \`${recentCaseId}\`. The case may no longer exist.`);
        return;
      }

      // Get the updated case to show details
      const caseData = getCase(recentCaseId);

      if (!caseData) {
        await message.reply('❌ Failed to retrieve updated case information.');
        return;
      }

      // Create confirmation embed
      const confirmEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('Proof Added to Case')
        .addFields(
          { name: 'Case ID', value: caseData.caseId, inline: true },
          { name: 'Type', value: caseData.type, inline: true },
          { name: 'Target', value: caseData.targetTag, inline: true },
          { name: 'Added Proof', value: proof, inline: false }
        )
        .setTimestamp();

      // Show all proof if there's multiple
      if (caseData.proof && caseData.proof !== proof) {
        const proofLines = caseData.proof.split('\n');
        if (proofLines.length > 1) {
          confirmEmbed.addFields({ 
            name: 'Total Proof Links', 
            value: `${proofLines.length} proof items attached`, 
            inline: false 
          });
        }
      }

      await message.reply({ embeds: [confirmEmbed] });

      console.log(
        `✓ Proof added: ${message.author.tag} added proof to case ${recentCaseId}`
      );
    } catch (error) {
      console.error('Error executing setproof command:', error);
      await message.reply('❌ An error occurred while adding proof to the case.');
    }
  },
};

