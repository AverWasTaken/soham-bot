/**
 * Unmute command - Remove a user's timeout
 * Usage: v!unmute @user [reason]
 * 
 * Restricted to moderators only
 */

import { EmbedBuilder } from 'discord.js';
import { isModerator } from '../handlers/permissions.js';
import { logModAction, ModActionType } from '../handlers/modLog.js';
import { logModeratorAction } from '../handlers/modActionsDb.js';
import { getPrefix } from '../config.js';

const AUTHORIZED_USER_IDS = ['932320320222822400', '685580500596686967', '1407154399783948389'];

export default {
  name: 'unmute',
  aliases: ['untimeout'],
  description: 'Remove a user\'s timeout (Mod only)',

  /**
   * Execute the unmute command
   * @param message - The message that triggered the command
   * @param args - Command arguments (user mention/id and optional reason)
   */
  async execute(message: any, args: string[]) {
    // Check if user has moderator permissions
    if (!AUTHORIZED_USER_IDS.includes(message.author.id) && !isModerator(message.member)) {
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
        `**Usage:** \`${prefix}unmute @user [reason]\`\n` +
        `**Example:** \`${prefix}unmute @User Appealed\` or \`${prefix}unmute 123456789012345678 Timeout expired early\``
      );
      return;
    }

    try {
      // Parse user mention or ID
      const userInput = args[0];
      let userId: string;

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

      // Get the reason (everything after the user mention/id)
      const reason = args.slice(1).join(' ') || 'No reason provided';

      // Fetch the member (must be in server to remove timeout)
      const memberToUnmute = await message.guild.members.fetch(userId).catch(() => null);
      
      if (!memberToUnmute) {
        await message.reply('❌ User not found in this server.');
        return;
      }

      // Check if user is actually timed out
      if (!memberToUnmute.communicationDisabledUntil || memberToUnmute.communicationDisabledUntil < new Date()) {
        await message.reply('❌ This user is not currently timed out.');
        return;
      }

      // Check bot's permissions
      if (!message.guild.members.me.permissions.has('ModerateMembers')) {
        await message.reply('❌ I do not have permission to manage timeouts.');
        return;
      }

      // Check if bot can modify this member (role hierarchy)
      if (memberToUnmute.roles.highest.position >= message.guild.members.me.roles.highest.position) {
        await message.reply('❌ I cannot modify this user\'s timeout due to role hierarchy.');
        return;
      }

      // Try to DM the user
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('Timeout Removed')
          .setDescription(`Your timeout in **${message.guild.name}** has been removed`)
          .addFields(
            { name: 'Reason', value: reason, inline: false }
          )
          .setTimestamp();

        await memberToUnmute.send({ embeds: [dmEmbed] });
      } catch {
        // User has DMs disabled or blocked the bot
      }

      // Remove the timeout
      await memberToUnmute.timeout(null, `${reason} | Unmuted by ${message.author.tag}`);

      // Log to webhook and database
      const caseId = await logModAction({
        type: ModActionType.UNMUTE,
        moderator: {
          tag: message.author.tag,
          id: message.author.id,
        },
        target: {
          tag: memberToUnmute.user.tag,
          id: memberToUnmute.id,
        },
        reason,
        guild: {
          name: message.guild.name,
          id: message.guild.id,
        },
      });

      // Log moderator action
      logModeratorAction({
        moderatorId: message.author.id,
        moderatorTag: message.author.tag,
        actionType: 'UNMUTE',
        targetId: memberToUnmute.id,
        targetTag: memberToUnmute.user.tag,
        reason,
        guildId: message.guild.id,
        guildName: message.guild.name,
        caseId,
      });

      // Send confirmation embed
      const confirmEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('User Timeout Removed')
        .addFields(
          { name: 'User', value: `${memberToUnmute.user.tag} (${memberToUnmute.id})`, inline: true },
          { name: 'Moderator', value: message.author.tag, inline: true },
          { name: 'Case ID', value: caseId || 'N/A', inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await message.reply({ embeds: [confirmEmbed] });

      console.log(
        `✓ Unmute: ${message.author.tag} removed timeout from ${memberToUnmute.user.tag} (${userId}) | Case: ${caseId} | Reason: ${reason}`
      );
    } catch (error: any) {
      console.error('Error executing unmute command:', error);
      
      if (error.code === 50013) {
        await message.reply('❌ I do not have permission to modify this user\'s timeout.');
      } else if (error.code === 10007) {
        await message.reply('❌ User not found.');
      } else {
        await message.reply(`❌ An error occurred: ${error.message}`);
      }
    }
  },
};

