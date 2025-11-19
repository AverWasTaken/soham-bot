/**
 * Updateproof command - Attach proof to a specific case by ID
 * Usage: v!updateproof [case_id] [proof_url]
 * 
 * Restricted to moderators only
 */

import { EmbedBuilder, Message } from 'discord.js';
import { isModerator } from '../handlers/permissions.js';
import { updateCaseProof, getCase } from '../handlers/casesDb.js';
import { getPrefix } from '../config.js';

const AUTHORIZED_USER_IDS = ['932320320222822400', '685580500596686967', '1407154399783948389'];

export default {
  name: 'updateproof',
  description: 'Attach proof to a specific case by ID (Mod only)',

  /**
   * Execute the updateproof command
   * @param message - The message that triggered the command
   * @param args - Command arguments (case ID and proof URL or text)
   */
  async execute(message: Message, args: string[]) {
    // Check if user has moderator permissions
    if (!AUTHORIZED_USER_IDS.includes(message.author.id) && !isModerator(message.member)) {
      await message.reply('❌ You do not have permission to use this command.');
      return;
    }

    // Validate arguments
    if (args.length < 2) {
      const prefix = getPrefix();
      await message.reply(
        `**Usage:** \`${prefix}updateproof [case_id] [proof_url]\`\n` +
        `**Example:** \`${prefix}updateproof XfgTy https://imgur.com/a/abc123\`\n\n` +
        'This will attach the proof to the specified case. You can run this multiple times to add more proof.'
      );
      return;
    }

    try {
      const caseId = args[0];
      const proof = args.slice(1).join(' ');

      // Check if case exists
      const caseData = getCase(caseId);
      
      if (!caseData) {
        await message.reply(`❌ Case \`${caseId}\` not found.`);
        return;
      }

      // Update the case with proof
      const updated = updateCaseProof(caseId, proof);

      if (!updated) {
        await message.reply(`❌ Failed to update case \`${caseId}\`.`);
        return;
      }

      // Get the updated case to show details
      const updatedCase = getCase(caseId);

      if (!updatedCase) {
        await message.reply('❌ Failed to retrieve updated case information.');
        return;
      }

      // Create confirmation embed
      const confirmEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('Proof Added to Case')
        .addFields(
          { name: 'Case ID', value: updatedCase.caseId, inline: true },
          { name: 'Type', value: updatedCase.type, inline: true },
          { name: 'Target', value: updatedCase.targetTag, inline: true },
          { name: 'Added Proof', value: proof, inline: false }
        )
        .setTimestamp();

      // Show all proof if there's multiple
      if (updatedCase.proof && updatedCase.proof !== proof) {
        const proofLines = updatedCase.proof.split('\n');
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
        `✓ Proof added: ${message.author.tag} added proof to case ${caseId}`
      );
    } catch (error) {
      console.error('Error executing updateproof command:', error);
      await message.reply('❌ An error occurred while adding proof to the case.');
    }
  },
};

