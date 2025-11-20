/**
 * Ban command - Ban a user from the server
 * Usage: v!ban @user [reason]
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
  name: 'ban',
  description: 'Ban a user from the server (Mod only)',

  /**
   * Execute the ban command
   * @param message - The message that triggered the command
   * @param args - Command arguments (user mention/id and optional reason)
   */
  async execute(message: Message, args: string[]) {
    // Check if user has full moderator permissions (trial mods cannot ban)
    if (!(await requireFullModerator(message))) return;

    // Check if command is used in a guild
    if (!(await requireGuild(message))) return;

    // Validate arguments
    if (args.length === 0) {
      const prefix = getPrefix();
      await message.reply(
        `**Usage:** \`${prefix}ban @user [reason]\`\n` +
        `**Example:** \`${prefix}ban @User Spamming\` or \`${prefix}ban 123456789012345678 Inappropriate behavior\``
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

      // Fetch the user
      const userToBan = await message.client.users.fetch(userId).catch(() => null);
      
      if (!userToBan) {
        await message.reply('❌ User not found.');
        return;
      }

      // Try to fetch member (to check if they're in the server)
      const memberToBan = await message.guild!.members.fetch(userId).catch(() => null);

      // Validate the moderation action
      const validation = validateModAction(
        message,
        memberToBan,
        userId,
        'ban',
        PermissionFlagsBits.BanMembers
      );

      if (!validation.valid) {
        await message.reply(validation.error!);
        return;
      }

      // Try to DM the user before banning
      let dmSent = false;
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xFF0000)
          .setTitle('Banned from Server')
          .setDescription(`You have been banned from **${message.guild!.name}**`)
          .addFields(
            { name: 'Reason', value: reason, inline: false }
          )
          .setFooter({ text: `You can appeal this punishment by sending me "${getPrefix()}appeal" in DMs` })
          .setTimestamp();

        await userToBan.send({ embeds: [dmEmbed] });
        dmSent = true;
      } catch {
        // User has DMs disabled or blocked the bot
      }

      // Track punishment for appeal system (only if DM was successful)
      if (dmSent) {
        trackPunishment({
          userId: userToBan.id,
          userTag: userToBan.tag,
          guildId: message.guild!.id,
          guildName: message.guild!.name,
          punishmentType: 'ban',
          reason,
          timestamp: Date.now(),
        });
      }

      // Ban the user
      await message.guild!.members.ban(userId, {
        reason: `${reason} | Banned by ${message.author.tag}`,
        deleteMessageSeconds: 86400, // Delete messages from last 24 hours
      });

      // Log to database
      const caseId = await logModAction({
        type: ModActionType.BAN,
        moderator: {
          tag: message.author.tag,
          id: message.author.id,
        },
        target: {
          tag: userToBan.tag,
          id: userToBan.id,
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
        actionType: 'BAN',
        targetId: userToBan.id,
        targetTag: userToBan.tag,
        reason,
        guildId: message.guild!.id,
        guildName: message.guild!.name,
        caseId,
      });

      // Send confirmation embed
      const confirmEmbed = new EmbedBuilder()
        .setColor(0xFF0000)
        .setTitle('User Banned')
        .addFields(
          { name: 'User', value: `${userToBan.tag} (${userToBan.id})`, inline: true },
          { name: 'Moderator', value: message.author.tag, inline: true },
          { name: 'Case ID', value: caseId || 'N/A', inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await message.reply({ embeds: [confirmEmbed] });

      console.log(
        `✓ Ban: ${message.author.tag} banned ${userToBan.tag} (${userId}) | Case: ${caseId} | Reason: ${reason}`
      );
    } catch (error: any) {
      await handleCommandError(error, message, 'ban');
    }
  },
};

