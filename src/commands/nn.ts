/**
 * Nickname command - Set a user's nickname
 * Usage: v!nn <nickname> - Set your own nickname
 * Usage: v!nn @user <nickname> - Set another user's nickname (mod only)
 * Usage: v!nn - Reset your own nickname
 * Usage: v!nn @user - Reset a user's nickname (mod only)
 */

import { EmbedBuilder, Message, PermissionFlagsBits } from 'discord.js';
import {
  parseUserInput,
  handleCommandError,
  requireGuild,
} from '../utils/commandUtils.js';
import { isModerator } from '../handlers/permissions.js';
import { getPrefix } from '../config.js';

export default {
  name: 'nn',
  description: 'Set a nickname for yourself or another user',

  async execute(message: Message, args: string[]) {
    if (!(await requireGuild(message))) return;

    const prefix = getPrefix();

    try {
      let targetMember = message.guild!.members.cache.get(message.author.id) 
        || await message.guild!.members.fetch(message.author.id);
      let nickname: string | null = null;
      let settingSelf = true;

      // Check if first arg is a user mention/ID
      if (args.length > 0) {
        const possibleUserId = parseUserInput(args[0]);
        if (possibleUserId) {
          // Targeting another user - requires mod perms
          const mod = await isModerator(message.member!);
          if (!mod) {
            await message.reply('❌ You need moderator permissions to change other users\' nicknames.');
            return;
          }

          const member = await message.guild!.members.fetch(possibleUserId).catch(() => null);
          if (!member) {
            await message.reply('❌ User not found in this server.');
            return;
          }

          targetMember = member;
          settingSelf = false;
          nickname = args.slice(1).join(' ') || null;
        } else {
          // No user mention, setting own nickname
          nickname = args.join(' ') || null;
        }
      }

      // Check nickname length
      if (nickname && nickname.length > 32) {
        await message.reply('❌ Nickname must be 32 characters or fewer.');
        return;
      }

      // Check permissions
      if (settingSelf) {
        if (!message.guild!.members.me?.permissions.has(PermissionFlagsBits.ManageNicknames)) {
          await message.reply('❌ I don\'t have permission to manage nicknames.');
          return;
        }
      } else {
        if (!targetMember.manageable) {
          await message.reply('❌ I can\'t change that user\'s nickname. They may have a higher role than me.');
          return;
        }
      }

      const oldNick = targetMember.nickname || targetMember.user.displayName;
      await targetMember.setNickname(nickname);

      const embed = new EmbedBuilder()
        .setColor(nickname ? 0x5865F2 : 0x99AAB5)
        .setDescription(
          nickname
            ? `✏️ **${settingSelf ? 'Your' : `${targetMember.user.tag}'s`}** nickname set to **${nickname}**`
            : `🔄 **${settingSelf ? 'Your' : `${targetMember.user.tag}'s`}** nickname has been reset`
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
    } catch (error: any) {
      await handleCommandError(error, message, 'nn');
    }
  },
};
