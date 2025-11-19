/**
 * Unban command - Remove a ban from a user
 * Usage: v!unban <userId> [reason]
 * 
 * Restricted to moderators only
 */

import { EmbedBuilder, Message, PermissionFlagsBits } from 'discord.js';
import { logModAction, ModActionType } from '../handlers/modLog.js';
import { logModeratorAction } from '../handlers/modActionsDb.js';
import {
  parseUserInput,
  handleCommandError,
  requireGuild,
  requireFullModerator,
} from '../utils/commandUtils.js';
import { getPrefix } from '../config.js';

export default {
  name: 'unban',
  description: 'Unban a user from the server (Mod only)',

  /**
   * Execute the unban command
   * @param message - The message that triggered the command
   * @param args - Command arguments (user id and optional reason)
   */
  async execute(message: Message, args: string[]) {
    // Check if user has full moderator permissions (trial mods cannot unban)
    if (!(await requireFullModerator(message))) return;

    // Check if command is used in a guild
    if (!(await requireGuild(message))) return;

    // Validate arguments
    if (args.length === 0) {
      const prefix = getPrefix();
      await message.reply(
        `**Usage:** \`${prefix}unban <userId> [reason]\`\n` +
        `**Example:** \`${prefix}unban 123456789012345678 Appeal accepted\``
      );
      return;
    }

    try {
      // Parse user ID (unbans don't work with mentions, only IDs)
      const userId = parseUserInput(args[0]);

      if (!userId) {
        await message.reply('❌ Invalid user ID. Please provide a valid user ID (not a mention).');
        return;
      }

      // Check if bot has permission to ban members (needed to unban)
      if (!message.guild!.members.me?.permissions.has(PermissionFlagsBits.BanMembers)) {
        await message.reply('❌ I do not have permission to manage bans in this server.');
        return;
      }

      // Get the reason
      const reason = args.slice(1).join(' ') || 'No reason provided';

      // Check if user is actually banned
      let bannedUser;
      try {
        bannedUser = await message.guild!.bans.fetch(userId);
      } catch (error) {
        await message.reply('❌ This user is not banned or the user ID is invalid.');
        return;
      }

      // Fetch user info
      const userToUnban = await message.client.users.fetch(userId).catch(() => null);

      if (!userToUnban) {
        await message.reply('❌ User not found. They may have deleted their account.');
        return;
      }

      // Unban the user
      await message.guild!.members.unban(userId, `${reason} | Unbanned by ${message.author.tag}`);

      // Try to DM the user
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0x00FF00)
          .setTitle('Unbanned from Server')
          .setDescription(`You have been unbanned from **${message.guild!.name}**`)
          .addFields(
            { name: 'Reason', value: reason, inline: false },
            { name: 'Moderator', value: message.author.tag, inline: false }
          )
          .setFooter({ text: 'You can now rejoin the server if you have an invite link.' })
          .setTimestamp();

        await userToUnban.send({ embeds: [dmEmbed] });
      } catch {
        // User has DMs disabled or blocked the bot
      }

      // Log to webhook and database
      const caseId = await logModAction({
        type: ModActionType.UNBAN,
        moderator: {
          tag: message.author.tag,
          id: message.author.id,
        },
        target: {
          tag: userToUnban.tag,
          id: userToUnban.id,
        },
        reason,
        guild: {
          name: message.guild!.name,
          id: message.guild!.id,
        },
      });

      // Log moderator action
      logModeratorAction({
        moderatorId: message.author.id,
        moderatorTag: message.author.tag,
        actionType: 'UNBAN',
        targetId: userToUnban.id,
        targetTag: userToUnban.tag,
        reason,
        guildId: message.guild!.id,
        guildName: message.guild!.name,
        caseId,
      });

      // Send confirmation embed
      const confirmEmbed = new EmbedBuilder()
        .setColor(0x00FF00)
        .setTitle('User Unbanned')
        .addFields(
          { name: 'User', value: `${userToUnban.tag} (${userToUnban.id})`, inline: true },
          { name: 'Moderator', value: message.author.tag, inline: true },
          { name: 'Case ID', value: caseId || 'N/A', inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await message.reply({ embeds: [confirmEmbed] });

      console.log(
        `✓ Unban: ${message.author.tag} unbanned ${userToUnban.tag} (${userId}) | Case: ${caseId} | Reason: ${reason}`
      );
    } catch (error: any) {
      await handleCommandError(error, message, 'unban');
    }
  },
};

