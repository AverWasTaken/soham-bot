/**
 * Mute command - Timeout a user using Discord's timeout system
 * Usage: v!mute @user [duration] [reason]
 * 
 * Duration format: 1s, 5m, 2h, 3d (seconds, minutes, hours, days)
 * Maximum timeout: 28 days
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
  requireModerator,
} from '../utils/commandUtils.js';
import { parseDuration, formatDuration } from '../utils/timeUtils.js';
import { getPrefix } from '../config.js';

export default {
  name: 'mute',
  aliases: ['timeout'],
  description: 'Timeout a user (Mod only)',

  /**
   * Execute the mute command
   * @param message - The message that triggered the command
   * @param args - Command arguments (user mention/id, duration, and optional reason)
   */
  async execute(message: Message, args: string[]) {
    // Check if user has moderator permissions
    if (!(await requireModerator(message))) return;

    // Check if command is used in a guild
    if (!(await requireGuild(message))) return;

    // Validate arguments
    if (args.length < 2) {
      const prefix = getPrefix();
      await message.reply(
        `**Usage:** \`${prefix}mute @user [duration] [reason]\`\n` +
        '**Duration formats:** `1s` (seconds), `5m` (minutes), `2h` (hours), `3d` (days)\n' +
        `**Example:** \`${prefix}mute @User 1h Spamming\` or \`${prefix}mute 123456789012345678 30m Inappropriate behavior\``
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

      // Parse duration
      const durationString = args[1];
      const duration = parseDuration(durationString);

      if (!duration) {
        await message.reply(
          '❌ Invalid duration format. Use formats like `1s`, `5m`, `2h`, `3d`\n' +
          '**Examples:** `30s`, `15m`, `2h`, `1d`'
        );
        return;
      }

      // Discord's maximum timeout is 28 days
      const MAX_TIMEOUT_MS = 28 * 24 * 60 * 60 * 1000; // 28 days in milliseconds
      if (duration > MAX_TIMEOUT_MS) {
        await message.reply('❌ Maximum timeout duration is 28 days.');
        return;
      }

      // Minimum timeout is 1 second
      if (duration < 1000) {
        await message.reply('❌ Minimum timeout duration is 1 second.');
        return;
      }

      // Get the reason (everything after the duration)
      const reason = args.slice(2).join(' ') || 'No reason provided';

      // Fetch the member (must be in server to timeout)
      const memberToMute = await message.guild!.members.fetch(userId).catch(() => null);
      
      if (!memberToMute) {
        await message.reply('❌ User not found in this server.');
        return;
      }

      // Validate the moderation action
      const validation = validateModAction(
        message,
        memberToMute,
        userId,
        'mute',
        PermissionFlagsBits.ModerateMembers
      );

      if (!validation.valid) {
        await message.reply(validation.error!);
        return;
      }

      // Try to DM the user before timing out
      let dmSent = false;
      try {
        const dmEmbed = new EmbedBuilder()
          .setColor(0xFFA500)
          .setTitle('Timed Out')
          .setDescription(`You have been timed out in **${message.guild!.name}**`)
          .addFields(
            { name: 'Duration', value: formatDuration(duration), inline: false },
            { name: 'Reason', value: reason, inline: false }
          )
          .setFooter({ text: `You can appeal this punishment by sending me "${getPrefix()}appeal" in DMs` })
          .setTimestamp();

        await memberToMute.send({ embeds: [dmEmbed] });
        dmSent = true;
      } catch {
        // User has DMs disabled or blocked the bot
      }

      // Track punishment for appeal system (only if DM was successful)
      if (dmSent) {
        trackPunishment({
          userId: memberToMute.id,
          userTag: memberToMute.user.tag,
          guildId: message.guild!.id,
          guildName: message.guild!.name,
          punishmentType: 'mute',
          reason,
          timestamp: Date.now(),
        });
      }

      // Timeout the user
      await memberToMute.timeout(duration, `${reason} | Muted by ${message.author.tag}`);

      // Calculate timeout end time
      const timeoutUntil = new Date(Date.now() + duration);

      // Log to webhook and database
      const caseId = await logModAction({
        type: ModActionType.MUTE,
        moderator: {
          tag: message.author.tag,
          id: message.author.id,
        },
        target: {
          tag: memberToMute.user.tag,
          id: memberToMute.id,
        },
        reason,
        duration: formatDuration(duration),
        additionalInfo: `<t:${Math.floor(timeoutUntil.getTime() / 1000)}:F>`,
        guild: {
          name: message.guild!.name,
          id: message.guild!.id,
        },
      });

      // Log moderator action
      logModeratorAction({
        moderatorId: message.author.id,
        moderatorTag: message.author.tag,
        actionType: 'MUTE',
        targetId: memberToMute.id,
        targetTag: memberToMute.user.tag,
        reason,
        guildId: message.guild!.id,
        guildName: message.guild!.name,
        caseId,
      });

      // Send confirmation embed
      const confirmEmbed = new EmbedBuilder()
        .setColor(0xFFA500)
        .setTitle('User Timed Out')
        .addFields(
          { name: 'User', value: `${memberToMute.user.tag} (${memberToMute.id})`, inline: true },
          { name: 'Moderator', value: message.author.tag, inline: true },
          { name: 'Case ID', value: caseId || 'N/A', inline: true },
          { name: 'Duration', value: formatDuration(duration), inline: true },
          { name: 'Timeout Until', value: `<t:${Math.floor(timeoutUntil.getTime() / 1000)}:F>`, inline: false },
          { name: 'Reason', value: reason, inline: false }
        )
        .setTimestamp();

      await message.reply({ embeds: [confirmEmbed] });

      console.log(
        `✓ Mute: ${message.author.tag} muted ${memberToMute.user.tag} (${userId}) for ${formatDuration(duration)} | Case: ${caseId} | Reason: ${reason}`
      );
    } catch (error: any) {
      await handleCommandError(error, message, 'mute');
    }
  },
};

