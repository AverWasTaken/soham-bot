/**
 * Kick command - Kick a user from the server
 * Usage: v!kick @user [reason]
 * 
 * Restricted to moderators only
 */

import { EmbedBuilder, Message, PermissionFlagsBits } from 'discord.js';
import { logModAction, ModActionType } from '../handlers/modLog.js';
import { trackPunishment } from '../handlers/punishmentTracker.js';
import { logModeratorAction } from '../handlers/modActionsDb.js';
import {
  parseUserInput,
  validateModAction,
  handleCommandError,
  requireGuild,
  requireFullModerator,
} from '../utils/commandUtils.js';
import { getPrefix } from '../config.js';

export default {
  name: 'kick',
  description: 'Kick a user from the server (Mod only)',

  /**
   * Execute the kick command
   * @param message - The message that triggered the command
   * @param args - Command arguments (user mention/id and optional reason)
   */
  async execute(message: Message, args: string[]) {
    // Check if user has full moderator permissions (trial mods cannot kick)
    if (!(await requireFullModerator(message))) return;

    // Check if command is used in a guild
    if (!(await requireGuild(message))) return;

    // Validate arguments
    if (args.length === 0) {
      const prefix = getPrefix();
      await message.reply(
        `**Usage:** \`${prefix}kick @user [reason]\`\n` +
        `**Example:** \`${prefix}kick @User Spamming\` or \`${prefix}kick 123456789012345678 Rule violation\``
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

      // Get the reason (everything after the user mention/id)
      const reason = args.slice(1).join(' ') || 'No reason provided';

      // Fetch the member (must be in server to kick)
      const memberToKick = await message.guild!.members.fetch(userId).catch(() => null);
      
      if (!memberToKick) {
        await message.reply('❌ User not found in this server.');
        return;
      }

      // Validate the moderation action
      const validation = validateModAction(
        message,
        memberToKick,
        userId,
        'kick',
        PermissionFlagsBits.KickMembers
      );

      if (!validation.valid) {
        await message.reply(validation.error!);
        return;
      }

      // Try to DM the user before kicking
      let dmSent = false;
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xFF6600)
          .setTitle('Kicked from Server')
          .setDescription(`You have been kicked from **${message.guild!.name}**`)
          .addFields(
            { name: 'Reason', value: reason, inline: false }
          )
          .setFooter({ text: `You can appeal this punishment by sending me "${getPrefix()}appeal" in DMs` })
          .setTimestamp();

        await memberToKick.send({ embeds: [dmEmbed] });
        dmSent = true;
      } catch {
        // User has DMs disabled or blocked the bot
      }

      // Track punishment for appeal system (only if DM was successful)
      if (dmSent) {
        trackPunishment({
          userId: memberToKick.id,
          userTag: memberToKick.user.tag,
          guildId: message.guild!.id,
          guildName: message.guild!.name,
          punishmentType: 'kick',
          reason,
          timestamp: Date.now(),
        });
      }

      // Kick the user
      await memberToKick.kick(`${reason} | Kicked by ${message.author.tag}`);

      // Log to database
      const caseId = await logModAction({
        type: ModActionType.KICK,
        moderator: {
          tag: message.author.tag,
          id: message.author.id,
        },
        target: {
          tag: memberToKick.user.tag,
          id: memberToKick.id,
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
        actionType: 'KICK',
        targetId: memberToKick.id,
        targetTag: memberToKick.user.tag,
        reason,
        guildId: message.guild!.id,
        guildName: message.guild!.name,
        caseId,
      });

      // Send confirmation embed
      const confirmEmbed = new EmbedBuilder()
        .setColor(0xFF6600)
        .setTitle('User Kicked')
        .addFields(
          { name: 'User', value: `${memberToKick.user.tag} (${memberToKick.id})`, inline: true },
          { name: 'Moderator', value: message.author.tag, inline: true },
          { name: 'Case ID', value: caseId || 'N/A', inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await message.reply({ embeds: [confirmEmbed] });

      console.log(
        `✓ Kick: ${message.author.tag} kicked ${memberToKick.user.tag} (${userId}) | Case: ${caseId} | Reason: ${reason}`
      );
    } catch (error: any) {
      await handleCommandError(error, message, 'kick');
    }
  },
};

