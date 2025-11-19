/**
 * Purge command - Delete multiple messages at once
 * Usage:
 * - v!purge [amount] - Delete the specified number of messages
 * - v!purge between [msg_id] [msg_id] - Delete messages between two message IDs
 * - v!purge before [msg_id] - Delete messages before a message ID
 * - v!purge after [msg_id] - Delete messages after a message ID
 * 
 * Restricted to moderators only
 */

import { EmbedBuilder, Message, TextChannel } from 'discord.js';
import { isModerator } from '../handlers/permissions.js';
import { logModAction, ModActionType } from '../handlers/modLog.js';
import { getPrefix } from '../config.js';
import type { DiscordCommand } from '../types/command.js';
import { replyWithAutoDelete } from '../utils/replyUtils.js';

const AUTHORIZED_USER_IDS = ['932320320222822400', '685580500596686967', '1407154399783948389'];

const command: DiscordCommand = {
  name: 'purge',
  aliases: ['clear', 'prune'],
  description: 'Delete multiple messages at once (Mod only)',
  cooldownSeconds: 5,

  /**
   * Execute the purge command
   * @param message - The message that triggered the command
   * @param args - Command arguments
   */
  async execute(message: any, args: string[]) {
    // Check if user has moderator permissions
    if (!AUTHORIZED_USER_IDS.includes(message.author.id) && !isModerator(message.member)) {
      await message.reply('❌ You do not have permission to use this command.');
      return;
    }

    // Check if command is used in a guild text channel
    if (!message.guild || !(message.channel instanceof TextChannel)) {
      await message.reply('❌ This command can only be used in a server text channel.');
      return;
    }

    // Validate arguments
    if (args.length === 0) {
      await showUsage(message);
      return;
    }

    const subcommand = args[0].toLowerCase();

    try {
      // Handle different purge modes
      if (subcommand === 'between' && args.length === 3) {
        await handlePurgeBetween(message, args[1], args[2]);
      } else if (subcommand === 'before' && args.length === 2) {
        await handlePurgeBefore(message, args[1]);
      } else if (subcommand === 'after' && args.length === 2) {
        await handlePurgeAfter(message, args[1]);
      } else if (!isNaN(parseInt(subcommand))) {
        // First argument is a number - purge by amount
        await handlePurgeAmount(message, parseInt(subcommand));
      } else {
        await showUsage(message);
      }

    } catch (error: any) {
      console.error('Error executing purge command:', error);
      await message.reply(`❌ An error occurred: ${error.message}`);
    }
  },
};

export default command;

/**
 * Show command usage
 */
async function showUsage(message: any): Promise<void> {
  const prefix = getPrefix();
  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle('Purge Command Usage')
    .setDescription('Delete multiple messages at once')
    .addFields(
      {
        name: `${prefix}purge [amount]`,
        value: `Delete the specified number of messages (1-100)\nExample: \`${prefix}purge 50\``,
        inline: false,
      },
      {
        name: `${prefix}purge between [msg_id] [msg_id]`,
        value: `Delete messages between two message IDs (inclusive)\nExample: \`${prefix}purge between 123456789 987654321\``,
        inline: false,
      },
      {
        name: `${prefix}purge before [msg_id]`,
        value: `Delete messages before a message ID\nExample: \`${prefix}purge before 123456789\``,
        inline: false,
      },
      {
        name: `${prefix}purge after [msg_id]`,
        value: `Delete messages after a message ID\nExample: \`${prefix}purge after 123456789\``,
        inline: false,
      }
    )
    .setFooter({ text: 'Note: Discord limits bulk delete to messages less than 14 days old' });

  await message.reply({ embeds: [embed] });
}

/**
 * Purge a specific amount of messages
 */
async function handlePurgeAmount(message: any, amount: number): Promise<void> {
  // Validate amount
  if (amount < 1 || amount > 100) {
    await message.reply('❌ Amount must be between 1 and 100.');
    return;
  }

  const channel = message.channel as TextChannel;

  // Fetch messages (amount + 1 to include the command message)
  const messages = await channel.messages.fetch({ limit: amount + 1 });

  // Bulk delete
  const deleted = await channel.bulkDelete(messages, true);

  // Send confirmation (auto-deletes after 5 seconds)
  await replyWithAutoDelete(channel, `✅ Successfully deleted **${deleted.size}** message${deleted.size !== 1 ? 's' : ''}.`, 5000);

  // Log to webhook
  await logModAction({
    type: ModActionType.PURGE,
    moderator: {
      tag: message.author.tag,
      id: message.author.id,
    },
    messageCount: deleted.size,
    channel: {
      name: channel.name,
      id: channel.id,
    },
    additionalInfo: `Purged ${amount} messages`,
    guild: {
      name: message.guild.name,
      id: message.guild.id,
    },
  });

  console.log(
    `✓ Purge: ${message.author.tag} deleted ${deleted.size} messages in #${channel.name}`
  );
}

/**
 * Purge messages between two message IDs
 */
async function handlePurgeBetween(
  message: any,
  messageId1: string,
  messageId2: string
): Promise<void> {
  const channel = message.channel as TextChannel;

  // Validate message IDs
  if (!isValidSnowflake(messageId1) || !isValidSnowflake(messageId2)) {
    await message.reply('❌ Invalid message ID format.');
    return;
  }

  // Determine which ID is older (smaller snowflake = older)
  const [olderId, newerId] =
    BigInt(messageId1) < BigInt(messageId2)
      ? [messageId1, messageId2]
      : [messageId2, messageId1];

  try {
    // Verify both messages exist
    await channel.messages.fetch(olderId);
    await channel.messages.fetch(newerId);

    // Collect messages between the two IDs
    const messagesToDelete: Message[] = [];
    let lastId = newerId;
    let collecting = true;

    while (collecting && messagesToDelete.length < 100) {
      const fetched = await channel.messages.fetch({
        limit: 100,
        before: lastId,
      });

      if (fetched.size === 0) break;

      for (const msg of fetched.values()) {
        if (BigInt(msg.id) >= BigInt(olderId) && BigInt(msg.id) <= BigInt(newerId)) {
          messagesToDelete.push(msg);
        }
        if (BigInt(msg.id) < BigInt(olderId)) {
          collecting = false;
          break;
        }
      }

      lastId = fetched.last()?.id || lastId;
    }

    if (messagesToDelete.length === 0) {
      await message.reply('❌ No messages found between those IDs.');
      return;
    }

    // Delete command message
    await message.delete().catch(() => {});

    // Bulk delete collected messages
    let totalDeleted = 0;
    for (let i = 0; i < messagesToDelete.length; i += 100) {
      const chunk = messagesToDelete.slice(i, i + 100);
      const deleted = await channel.bulkDelete(chunk, true);
      totalDeleted += deleted.size;
    }

    // Send confirmation
    const confirmMsg = await channel.send(
      `✅ Successfully deleted **${totalDeleted}** message${totalDeleted !== 1 ? 's' : ''} between the specified IDs.`
    );

    setTimeout(() => confirmMsg.delete().catch(() => {}), 5000);

    // Log to webhook
    await logModAction({
      type: ModActionType.PURGE,
      moderator: {
        tag: message.author.tag,
        id: message.author.id,
      },
      messageCount: totalDeleted,
      channel: {
        name: channel.name,
        id: channel.id,
      },
      additionalInfo: `Purged messages between ${messageId1} and ${messageId2}`,
      guild: {
        name: message.guild.name,
        id: message.guild.id,
      },
    });

    console.log(
      `✓ Purge Between: ${message.author.tag} deleted ${totalDeleted} messages in #${channel.name}`
    );
  } catch (error: any) {
    if (error.code === 10008) {
      await message.reply('❌ One or both message IDs were not found in this channel.');
    } else {
      throw error;
    }
  }
}

/**
 * Purge messages before a message ID
 */
async function handlePurgeBefore(message: any, messageId: string): Promise<void> {
  const channel = message.channel as TextChannel;

  // Validate message ID
  if (!isValidSnowflake(messageId)) {
    await message.reply('❌ Invalid message ID format.');
    return;
  }

  try {
    // Verify message exists
    await channel.messages.fetch(messageId);

    // Fetch messages before the specified ID
    const messagesToDelete = await channel.messages.fetch({
      limit: 100,
      before: messageId,
    });

    if (messagesToDelete.size === 0) {
      await message.reply('❌ No messages found before that ID.');
      return;
    }

    // Delete command message
    await message.delete().catch(() => {});

    // Bulk delete
    const deleted = await channel.bulkDelete(messagesToDelete, true);

    // Send confirmation
    const confirmMsg = await channel.send(
      `✅ Successfully deleted **${deleted.size}** message${deleted.size !== 1 ? 's' : ''} before the specified ID.`
    );

    setTimeout(() => confirmMsg.delete().catch(() => {}), 5000);

    // Log to webhook
    await logModAction({
      type: ModActionType.PURGE,
      moderator: {
        tag: message.author.tag,
        id: message.author.id,
      },
      messageCount: deleted.size,
      channel: {
        name: channel.name,
        id: channel.id,
      },
      additionalInfo: `Purged messages before ${messageId}`,
      guild: {
        name: message.guild.name,
        id: message.guild.id,
      },
    });

    console.log(
      `✓ Purge Before: ${message.author.tag} deleted ${deleted.size} messages in #${channel.name}`
    );
  } catch (error: any) {
    if (error.code === 10008) {
      await message.reply('❌ Message ID not found in this channel.');
    } else {
      throw error;
    }
  }
}

/**
 * Purge messages after a message ID
 */
async function handlePurgeAfter(message: any, messageId: string): Promise<void> {
  const channel = message.channel as TextChannel;

  // Validate message ID
  if (!isValidSnowflake(messageId)) {
    await message.reply('❌ Invalid message ID format.');
    return;
  }

  try {
    // Verify message exists
    await channel.messages.fetch(messageId);

    // Fetch messages after the specified ID (including command message)
    const messagesToDelete = await channel.messages.fetch({
      limit: 100,
      after: messageId,
    });

    // Add the command message to deletion list
    messagesToDelete.set(message.id, message);

    if (messagesToDelete.size === 1) {
      // Only the command message
      await message.reply('❌ No messages found after that ID.');
      return;
    }

    // Bulk delete
    const deleted = await channel.bulkDelete(messagesToDelete, true);

    // Send confirmation
    const confirmMsg = await channel.send(
      `✅ Successfully deleted **${deleted.size}** message${deleted.size !== 1 ? 's' : ''} after the specified ID.`
    );

    setTimeout(() => confirmMsg.delete().catch(() => {}), 5000);

    // Log to webhook
    await logModAction({
      type: ModActionType.PURGE,
      moderator: {
        tag: message.author.tag,
        id: message.author.id,
      },
      messageCount: deleted.size,
      channel: {
        name: channel.name,
        id: channel.id,
      },
      additionalInfo: `Purged messages after ${messageId}`,
      guild: {
        name: message.guild.name,
        id: message.guild.id,
      },
    });

    console.log(
      `✓ Purge After: ${message.author.tag} deleted ${deleted.size} messages in #${channel.name}`
    );
  } catch (error: any) {
    if (error.code === 10008) {
      await message.reply('❌ Message ID not found in this channel.');
    } else {
      throw error;
    }
  }
}

/**
 * Validate if a string is a valid Discord snowflake ID
 */
function isValidSnowflake(id: string): boolean {
  return /^\d{17,19}$/.test(id);
}

