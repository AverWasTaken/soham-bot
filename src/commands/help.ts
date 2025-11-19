/**
 * Help command - Display all available moderation commands
 * Usage: v!help or v!help [command]
 */

import { EmbedBuilder } from 'discord.js';
import { getPrefix } from '../config.js';

export default {
  name: 'help',
  aliases: ['h', 'commands'],
  description: 'Display all available moderation commands',

  /**
   * Execute the help command
   * @param message - The message that triggered the command
   * @param args - Command arguments (optional command name)
   */
  async execute(message: any, args: string[]) {
    const prefix = getPrefix();

    // If a specific command is requested
    if (args.length > 0) {
      await showCommandHelp(message, args[0], prefix);
      return;
    }

    // Create main help embed
    const mainEmbed = new EmbedBuilder()
      .setColor(0x0099FF)
      .setTitle('📚 Moderation Bot - Command Help')
      .setDescription(
        `Use \`${prefix}help [command]\` for detailed information about a specific command.\n` +
        `**Prefix:** \`${prefix}\``
      )
      .setTimestamp();

    // Moderation Commands
    const moderationCommands = [
      `\`${prefix}userinfo [@user]\` - View detailed user information`,
      `\`${prefix}warn @user [reason]\` - Issue a warning to a user`,
      `\`${prefix}mute @user [duration] [reason]\` - Timeout a user`,
      `\`${prefix}unmute @user [reason]\` - Remove a user's timeout`,
      `\`${prefix}kick @user [reason]\` - Kick a user from the server`,
      `\`${prefix}ban @user [reason]\` - Ban a user from the server`,
      `\`${prefix}unban [user_id] [reason]\` - Unban a user`,
      `\`${prefix}purge [amount]\` - Delete multiple messages`,
      `\`${prefix}mutelinks @user\` - Prevent a user from sending links`,
    ];

    mainEmbed.addFields({
      name: '🛡️ Moderation Commands',
      value: moderationCommands.join('\n'),
      inline: false,
    });

    // Case Management
    const caseCommands = [
      `\`${prefix}cases [@user]\` - View all moderation cases for a user`,
      `\`${prefix}warnings [@user]\` - View all warnings for a user`,
      `\`${prefix}caseinfo [case_id]\` - View details of a specific case`,
      `\`${prefix}delcase [case_id]\` - Delete a moderation case`,
      `\`${prefix}clearcases [@user]\` - Clear all cases for a user`,
      `\`${prefix}modactions\` - View recent moderation actions`,
    ];

    mainEmbed.addFields({
      name: '📋 Case Management',
      value: caseCommands.join('\n'),
      inline: false,
    });

    // Appeal Management
    const appealCommands = [
      `\`${prefix}appeal\` - Start a ban appeal (DM only)`,
      `\`${prefix}acceptappeal [appeal_id]\` - Accept a user's appeal`,
      `\`${prefix}denyappeal [appeal_id]\` - Deny a user's appeal`,
    ];

    mainEmbed.addFields({
      name: '🤝 Appeal Management',
      value: appealCommands.join('\n'),
      inline: false,
    });

    // Utilities
    const utilityCommands = [
      `\`${prefix}report [reason]\` - Report a message (reply to the message)`,
      `\`${prefix}automodstats\` - View automod statistics`,
    ];

    mainEmbed.addFields({
      name: '⚙️ Utilities',
      value: utilityCommands.join('\n'),
      inline: false,
    });

    mainEmbed.setFooter({ 
      text: 'All commands are available | For detailed help on a command, use help [command]'
    });

    await message.reply({ embeds: [mainEmbed] });
  },
};

/**
 * Show detailed help for a specific command
 */
async function showCommandHelp(message: any, commandName: string, prefix: string): Promise<void> {
  const commandHelp: { [key: string]: { description: string; usage: string; aliases?: string; examples?: string } } = {
    userinfo: {
      description: 'Display detailed information about a user including account age, roles, join date, and moderation history.',
      usage: `${prefix}userinfo [@user]\n${prefix}userinfo [user_id]`,
      aliases: 'whois, ui, user',
      examples: `${prefix}userinfo @User\n${prefix}userinfo 123456789012345678`,
    },
    warn: {
      description: 'Issue a warning to a user. Warnings are logged in the database with a case ID.',
      usage: `${prefix}warn @user [reason]`,
      aliases: 'warning',
      examples: `${prefix}warn @User Spamming in chat\n${prefix}warn 123456789012345678 Breaking rules`,
    },
    mute: {
      description: 'Timeout a user using Discord\'s native timeout system. Duration format: 1s, 5m, 2h, 3d (max 28 days).',
      usage: `${prefix}mute @user [duration] [reason]`,
      aliases: 'timeout',
      examples: `${prefix}mute @User 1h Spamming\n${prefix}mute @User 30m Inappropriate behavior`,
    },
    unmute: {
      description: 'Remove a user\'s timeout early.',
      usage: `${prefix}unmute @user [reason]`,
      aliases: 'untimeout',
      examples: `${prefix}unmute @User Appealed\n${prefix}unmute @User Good behavior`,
    },
    kick: {
      description: 'Kick a user from the server.',
      usage: `${prefix}kick @user [reason]`,
      examples: `${prefix}kick @User Spamming\n${prefix}kick 123456789012345678 Rule violation`,
    },
    ban: {
      description: 'Ban a user from the server. Deletes their messages from the last 24 hours.',
      usage: `${prefix}ban @user [reason]`,
      examples: `${prefix}ban @User Repeated violations\n${prefix}ban 123456789012345678 Harassment`,
    },
    unban: {
      description: 'Unban a user from the server.',
      usage: `${prefix}unban [user_id] [reason]`,
      examples: `${prefix}unban 123456789012345678 Appealed\n${prefix}unban 987654321098765432 Good behavior`,
    },
    purge: {
      description: 'Delete multiple messages at once. Discord limits bulk delete to messages less than 14 days old.',
      usage: `${prefix}purge [amount] - Delete X messages\n${prefix}purge between [id] [id] - Between two messages\n${prefix}purge before [id] - Before a message\n${prefix}purge after [id] - After a message`,
      aliases: 'clear, prune',
      examples: `${prefix}purge 50\n${prefix}purge between 123456 789012`,
    },
    mutelinks: {
      description: 'Prevent a user from sending links in the server.',
      usage: `${prefix}mutelinks @user\n${prefix}mutelinks remove @user`,
      examples: `${prefix}mutelinks @User\n${prefix}mutelinks remove @User`,
    },
    cases: {
      description: 'View all moderation cases (bans, kicks, mutes, warnings) for a user.',
      usage: `${prefix}cases @user\n${prefix}cases [user_id]`,
      aliases: 'history, modlog',
      examples: `${prefix}cases @User\n${prefix}cases 123456789012345678`,
    },
    warnings: {
      description: 'View only warnings for a user (filtered from all cases).',
      usage: `${prefix}warnings @user\n${prefix}warnings [user_id]`,
      aliases: 'warns',
      examples: `${prefix}warnings @User`,
    },
    caseinfo: {
      description: 'View detailed information about a specific moderation case.',
      usage: `${prefix}caseinfo [case_id]`,
      aliases: 'case, viewcase',
      examples: `${prefix}caseinfo aB3Cd\n${prefix}caseinfo XfgTy`,
    },
    delcase: {
      description: 'Delete a moderation case from the database.',
      usage: `${prefix}delcase [case_id]`,
      aliases: 'deletecase, removecase',
      examples: `${prefix}delcase aB3Cd`,
    },
    clearcases: {
      description: 'Clear all moderation cases for a user.',
      usage: `${prefix}clearcases @user\n${prefix}clearcases [user_id]`,
      examples: `${prefix}clearcases @User\n${prefix}clearcases 123456789012345678`,
    },
    modactions: {
      description: 'View recent moderation actions taken by moderators.',
      usage: `${prefix}modactions`,
      examples: `${prefix}modactions`,
    },
    appeal: {
      description: 'Start a ban appeal process. Can only be used in DMs with the bot.',
      usage: `DM the bot: ${prefix}appeal`,
      examples: `${prefix}appeal`,
    },
    acceptappeal: {
      description: 'Accept a user\'s ban appeal and unban them.',
      usage: `${prefix}acceptappeal [appeal_id]`,
      examples: `${prefix}acceptappeal abc123`,
    },
    denyappeal: {
      description: 'Deny a user\'s ban appeal.',
      usage: `${prefix}denyappeal [appeal_id]`,
      examples: `${prefix}denyappeal abc123`,
    },
    report: {
      description: 'Report a message to moderators. Reply to the message you want to report and use this command.',
      usage: `Reply to a message: ${prefix}report [reason]`,
      examples: `${prefix}report Spam\n${prefix}report Breaking server rules`,
    },
    automodstats: {
      description: 'View automod statistics including flagged messages and action types.',
      usage: `${prefix}automodstats`,
      examples: `${prefix}automodstats`,
    },
  };

  const command = commandHelp[commandName.toLowerCase()];

  if (!command) {
    await message.reply(`❌ Command \`${commandName}\` not found. Use \`${prefix}help\` to see all commands.`);
    return;
  }

  const embed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setTitle(`📖 Help: ${prefix}${commandName}`)
    .setDescription(command.description)
    .addFields({ name: '📝 Usage', value: `\`\`\`${command.usage}\`\`\``, inline: false })
    .setTimestamp();

  if (command.aliases) {
    embed.addFields({ name: '🔄 Aliases', value: command.aliases, inline: true });
  }

  if (command.examples) {
    embed.addFields({ name: '💡 Examples', value: `\`\`\`${command.examples}\`\`\``, inline: false });
  }

  await message.reply({ embeds: [embed] });
}

