/**
 * Warn command - Issue a warning to a user
 * Usage: v!warn @user [reason]
 * 
 * Warnings are logged in the database and can be viewed with v!cases
 * Restricted to moderators only
 */

import { EmbedBuilder, Message, PermissionFlagsBits } from 'discord.js';
import { logModAction, ModActionType } from '../handlers/modLog.js';
import { getCaseCount } from '../handlers/casesDb.js';
import { trackPunishment } from '../handlers/punishmentTracker.js';
import { logModeratorAction } from '../handlers/modActionsDb.js';
import {
  parseUserInput,
  validateModAction,
  handleCommandError,
  requireGuild,
  requireModerator,
} from '../utils/commandUtils.js';
import { getPrefix } from '../config.js';

export default {
  name: 'warn',
  aliases: ['warning'],
  description: 'Issue a warning to a user (Mod only)',

  /**
   * Execute the warn command
   * @param message - The message that triggered the command
   * @param args - Command arguments (user mention/id and optional reason)
   */
  async execute(message: Message, args: string[]) {
    // Check if user has moderator permissions
    if (!(await requireModerator(message))) return;

    // Check if command is used in a guild
    if (!(await requireGuild(message))) return;

    // Validate arguments
    if (args.length === 0) {
      const prefix = getPrefix();
      await message.reply(
        `**Usage:** \`${prefix}warn @user [reason]\`\n` +
        `**Example:** \`${prefix}warn @User Spamming in chat\` or \`${prefix}warn 123456789012345678 Breaking rules\``
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

      // Fetch the member (must be in server to warn)
      const memberToWarn = await message.guild!.members.fetch(userId).catch(() => null);
      
      if (!memberToWarn) {
        await message.reply('❌ User not found in this server.');
        return;
      }

      // Validate the moderation action
      const validation = validateModAction(
        message,
        memberToWarn,
        userId,
        'warn',
        PermissionFlagsBits.ModerateMembers
      );

      if (!validation.valid) {
        await message.reply(validation.error!);
        return;
      }

      // Get current warning count for this user
      const currentWarnings = getCaseCount(userId, message.guild!.id);

      // Try to DM the user
      let dmSent = false;
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xFFFF00)
          .setTitle('Warning Issued')
          .setDescription(`You have received a warning in **${message.guild!.name}**`)
          .addFields(
            { name: 'Reason', value: reason, inline: false },
            { name: 'Total Warnings', value: `${currentWarnings + 1}`, inline: true }
          )
          .setFooter({ text: `You can appeal this by sending me "${getPrefix()}appeal" in DMs` })
          .setTimestamp();

        await memberToWarn.send({ embeds: [dmEmbed] });
        dmSent = true;
      } catch {
        // User has DMs disabled or blocked the bot
      }

      // Track punishment for appeal system (only if DM was successful)
      if (dmSent) {
        trackPunishment({
          userId: memberToWarn.id,
          userTag: memberToWarn.user.tag,
          guildId: message.guild!.id,
          guildName: message.guild!.name,
          punishmentType: 'warn',
          reason,
          timestamp: Date.now(),
        });
      }

      // Log to webhook and database
      const caseId = await logModAction({
        type: ModActionType.WARN,
        moderator: {
          tag: message.author.tag,
          id: message.author.id,
        },
        target: {
          tag: memberToWarn.user.tag,
          id: memberToWarn.id,
        },
        reason,
        additionalInfo: `Total warnings: ${currentWarnings + 1}`,
        guild: {
          name: message.guild!.name,
          id: message.guild!.id,
        },
      });

      // Log moderator action
      logModeratorAction({
        moderatorId: message.author.id,
        moderatorTag: message.author.tag,
        actionType: 'WARN',
        targetId: memberToWarn.id,
        targetTag: memberToWarn.user.tag,
        reason,
        guildId: message.guild!.id,
        guildName: message.guild!.name,
        caseId,
      });

      // Send confirmation embed
      const confirmEmbed = new EmbedBuilder()
        .setColor(0xFFFF00)
        .setTitle('User Warned')
        .addFields(
          { name: 'User', value: `${memberToWarn.user.tag} (${memberToWarn.id})`, inline: true },
          { name: 'Moderator', value: message.author.tag, inline: true },
          { name: 'Case ID', value: caseId || 'N/A', inline: true },
          { name: 'Total Warnings', value: `${currentWarnings + 1}`, inline: true },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await message.reply({ embeds: [confirmEmbed] });

      console.log(
        `✓ Warn: ${message.author.tag} warned ${memberToWarn.user.tag} (${userId}) | Case: ${caseId} | Reason: ${reason} | Total Warnings: ${currentWarnings + 1}`
      );
    } catch (error: any) {
      await handleCommandError(error, message, 'warn');
    }
  },
};

