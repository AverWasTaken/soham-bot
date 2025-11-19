/**
 * Mutelinks command - Restrict users from sending links
 * Usage: v!mutelinks @user or v!mutelinks [user_id]
 * 
 * Features:
 * - Prevents specific users from sending any links
 * - Requires Manage Messages permission
 * - List all link-muted users
 * - Remove link mute from users
 */

import { EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import {
  addLinkMutedUser,
  removeLinkMutedUser,
  getLinkMutedUsers,
  isUserLinkMuted,
} from '../handlers/linkMute.js';

export default {
  name: 'mutelinks',
  aliases: ['linksmute', 'linkmute'],
  description: 'Restrict a user from sending links (Mod only)',

  /**
   * Execute the mutelinks command
   * @param message - The message that triggered the command
   * @param args - Command arguments
   */
  async execute(message: any, args: string[]) {
    // Check permission
    if (!message.member.permissions.has(PermissionFlagsBits.ManageMessages)) {
      await message.reply('❌ You need the **Manage Messages** permission to use this command.');
      return;
    }

    const subcommand = args[0]?.toLowerCase();

    // Handle list subcommand
    if (subcommand === 'list') {
      await handleListLinkMutes(message);
      return;
    }

    // Handle remove subcommand
    if (subcommand === 'remove' || subcommand === 'unmute') {
      const userArg = args[1];
      if (!userArg) {
        const { getPrefix } = await import('../config.js');
        const prefix = getPrefix();
        await message.reply(`❌ Usage: \`${prefix}mutelinks remove @user\` or \`${prefix}mutelinks remove [user_id]\``);
        return;
      }
      await handleRemoveLinkMute(message, userArg);
      return;
    }

    // Handle add/mute (default behavior)
    const userArg = args[0];
    if (!userArg) {
      const { getPrefix } = await import('../config.js');
      const prefix = getPrefix();
      await message.reply(
        'Usage:\n' +
        `\`${prefix}mutelinks @user\` - Mute a user from sending links\n` +
        `\`${prefix}mutelinks remove @user\` - Unmute a user\n` +
        `\`${prefix}mutelinks list\` - View all link-muted users`
      );
      return;
    }

    await handleAddLinkMute(message, userArg);
  },
};

/**
 * Add a user to the link mute list
 */
async function handleAddLinkMute(message: any, userArg: string): Promise<void> {
  try {
    // Extract user ID from mention or use as-is
    const userId = userArg.replace(/[<@!>]/g, '');

    // Validate user ID
    if (!/^\d+$/.test(userId)) {
      await message.reply('❌ Invalid user. Please mention a user or provide a valid user ID.');
      return;
    }

    // Fetch the user to verify they exist
    let targetUser;
    try {
      targetUser = await message.client.users.fetch(userId);
    } catch (error) {
      await message.reply('❌ User not found. Please check the user ID or mention.');
      return;
    }

    // Check if user is already link-muted
    if (isUserLinkMuted(userId)) {
      await message.reply(`❌ ${targetUser.tag} is already link-muted.`);
      return;
    }

    // Add to link mute list
    addLinkMutedUser(userId, message.author.id);

    const embed = new EmbedBuilder()
      .setColor(0xFF6600)
      .setTitle('🔇 User Link-Muted')
      .addFields(
        { name: 'User', value: `${targetUser.tag} (${userId})`, inline: true },
        { name: 'Muted By', value: `${message.author.tag}`, inline: true }
      )
      .setTimestamp();

    await message.reply({ embeds: [embed] });

    console.log(`✓ Link mute added by ${message.author.tag}: ${targetUser.tag} (${userId})`);
  } catch (error: any) {
    if (error.message === 'User already link-muted') {
      await message.reply('❌ This user is already link-muted.');
    } else {
      console.error('Error adding link mute:', error);
      await message.reply('❌ An error occurred while muting this user from links.');
    }
  }
}

/**
 * Remove a user from the link mute list
 */
async function handleRemoveLinkMute(message: any, userArg: string): Promise<void> {
  try {
    // Extract user ID from mention or use as-is
    const userId = userArg.replace(/[<@!>]/g, '');

    // Validate user ID
    if (!/^\d+$/.test(userId)) {
      await message.reply('❌ Invalid user. Please mention a user or provide a valid user ID.');
      return;
    }

    // Check if user is link-muted
    if (!isUserLinkMuted(userId)) {
      await message.reply('❌ This user is not link-muted.');
      return;
    }

    // Remove from link mute list
    removeLinkMutedUser(userId);

    // Fetch the user for display
    let targetUser;
    try {
      targetUser = await message.client.users.fetch(userId);
    } catch (error) {
      targetUser = { tag: 'Unknown User' };
    }

    const embed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('🔊 User Link-Unmuted')
      .addFields(
        { name: 'User', value: `${targetUser.tag} (${userId})`, inline: true },
        { name: 'Unmuted By', value: `${message.author.tag}`, inline: true }
      )
      .setTimestamp();

    await message.reply({ embeds: [embed] });

    console.log(`✓ Link mute removed by ${message.author.tag}: ${targetUser.tag} (${userId})`);
  } catch (error: any) {
    if (error.message === 'User not found') {
      await message.reply('❌ This user is not in the link mute list.');
    } else {
      console.error('Error removing link mute:', error);
      await message.reply('❌ An error occurred while unmuting this user from links.');
    }
  }
}

/**
 * List all link-muted users
 */
async function handleListLinkMutes(message: any): Promise<void> {
  try {
    const mutedUsers = getLinkMutedUsers();

    if (mutedUsers.length === 0) {
      await message.reply('📋 No users are currently link-muted.');
      return;
    }

    const embed = new EmbedBuilder()
      .setColor(0xFF6600)
      .setTitle('📋 Link-Muted Users')
      .setDescription(`Total: ${mutedUsers.length} user${mutedUsers.length !== 1 ? 's' : ''}`)
      .setTimestamp();

    // Fetch user details for each muted user
    for (const mute of mutedUsers.slice(0, 25)) { // Limit to 25 for embed field limit
      let userTag = 'Unknown User';
      try {
        const user = await message.client.users.fetch(mute.userId);
        userTag = user.tag;
      } catch (error) {
        // User not found or no longer exists
      }

      embed.addFields({
        name: `${userTag} (${mute.userId})`,
        value: `**Muted By:** <@${mute.mutedBy}>\n**Date:** ${new Date(mute.mutedAt).toLocaleDateString()}`,
        inline: false,
      });
    }

    if (mutedUsers.length > 25) {
      embed.setFooter({ text: `Showing 25 of ${mutedUsers.length} link-muted users` });
    }

    await message.reply({ embeds: [embed] });
  } catch (error) {
    console.error('Error listing link mutes:', error);
    await message.reply('❌ An error occurred while retrieving link-muted users.');
  }
}

