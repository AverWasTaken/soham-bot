/**
 * Userinfo command - Display detailed information about a user
 * Usage: v!userinfo [@user] or v!userinfo [user_id]
 * 
 * If no user is specified, shows info about the command user
 */

import { EmbedBuilder, GuildMember, Message } from 'discord.js';
import { isModerator } from '../handlers/permissions.js';
import { getCaseCount, getCasesByUser } from '../handlers/casesDb.js';
import { getTimeSince } from '../utils/timeUtils.js';
import { parseUserInput } from '../utils/commandUtils.js';

export default {
  name: 'userinfo',
  aliases: ['whois', 'ui', 'user'],
  description: 'Display detailed information about a user',

  /**
   * Execute the userinfo command
   * @param message - The message that triggered the command
   * @param args - Command arguments (optional user mention/id)
   */
  async execute(message: Message, args: string[]) {
    try {
      // Check if command is used in a guild
      if (!message.guild) {
        await message.reply('❌ This command can only be used in a server.');
        return;
      }

      // Check if user has moderator permissions
      if (!isModerator(message.member)) {
        await message.reply('❌ You do not have permission to use this command. This command is restricted to Trial Moderators and above.');
        return;
      }

      let targetMember: GuildMember;
      let targetUser;
      if (args.length === 0) {
        // No user specified, show info about command author
        targetMember = message.member!;
        targetUser = message.author;
      } else {
        // Parse user mention or ID
        const userId = parseUserInput(args[0]);

        if (!userId) {
          await message.reply('❌ Invalid user mention or ID. Please mention a user or provide their ID.');
          return;
        }

        // Fetch the member
        const fetchedMember = await message.guild.members.fetch(userId).catch(() => null);
        
        if (!fetchedMember) {
          await message.reply('❌ User not found in this server.');
          return;
        }

        targetMember = fetchedMember;
        targetUser = targetMember.user;
      }

      // Calculate account age
      const createdAt = targetUser.createdAt;
      const accountAge = getTimeSince(createdAt);

      // Calculate server join date
      const joinedAt = targetMember.joinedAt;
      const joinAge = joinedAt ? getTimeSince(joinedAt) : 'Unknown';

      // Get roles (excluding @everyone)
      const roles = targetMember.roles.cache
        .filter((role: any) => role.id !== message.guild!.id)
        .sort((a: any, b: any) => b.position - a.position)
        .map((role: any) => role.toString())
        .slice(0, 20); // Limit to 20 roles to avoid embed limits

      const roleDisplay = roles.length > 0 
        ? roles.join(', ') 
        : 'No roles';

      // Build embed
      const embed = new EmbedBuilder()
        .setColor(targetMember.displayColor || 0x0099FF)
        .setTitle(`User Information: ${targetUser.tag}`)
        .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
        .addFields(
          { 
            name: 'User', 
            value: `${targetUser.toString()}\n\`${targetUser.id}\``, 
            inline: true 
          },
          { 
            name: 'Nickname', 
            value: targetMember.nickname || 'None', 
            inline: true 
          },
          { 
            name: 'Bot', 
            value: targetUser.bot ? 'Yes' : 'No', 
            inline: true 
          },
          { 
            name: 'Account Created', 
            value: `<t:${Math.floor(createdAt.getTime() / 1000)}:F>\n(${accountAge} ago)`, 
            inline: false 
          },
          { 
            name: 'Joined Server', 
            value: joinedAt 
              ? `<t:${Math.floor(joinedAt.getTime() / 1000)}:F>\n(${joinAge} ago)` 
              : 'Unknown', 
            inline: false 
          },
          { 
            name: `Roles [${roles.length}]`, 
            value: roleDisplay.length > 1024 ? roleDisplay.substring(0, 1021) + '...' : roleDisplay,
            inline: false 
          }
        )
        .setTimestamp();

      // Add boost status if applicable
      if (targetMember.premiumSince) {
        const boostingSince = getTimeSince(targetMember.premiumSince);
        embed.addFields({
          name: 'Server Booster',
          value: `Since <t:${Math.floor(targetMember.premiumSince.getTime() / 1000)}:R> (${boostingSince})`,
          inline: true
        });
      }

      // Add moderation case count for moderators
      if (isModerator(message.member)) {
        const caseCount = getCaseCount(targetUser.id, message.guild!.id);
        
        if (caseCount > 0) {
          // Get warning count specifically
          const allCases = getCasesByUser(targetUser.id, message.guild!.id);
          const warningCount = allCases.filter(c => c.type === 'WARN').length;
          
          let caseValue = `${caseCount} total case${caseCount !== 1 ? 's' : ''}`;
          if (warningCount > 0) {
            caseValue += `\n${warningCount} warning${warningCount !== 1 ? 's' : ''}`;
          }
          
          embed.addFields({
            name: 'Moderation History',
            value: caseValue,
            inline: true
          });
        }
      }

      // Add key permissions if user has any
      const keyPermissions = getKeyPermissions(targetMember);
      if (keyPermissions.length > 0) {
        embed.addFields({
          name: 'Key Permissions',
          value: keyPermissions.join(', '),
          inline: false
        });
      }

      // Add acknowledgements/badges
      const acknowledgements = getAcknowledgements(targetMember);
      if (acknowledgements.length > 0) {
        embed.addFields({
          name: 'Acknowledgements',
          value: acknowledgements.join('\n'),
          inline: false
        });
      }

      await message.reply({ embeds: [embed] });
    } catch (error: any) {
      console.error('Error executing userinfo command:', error);
      console.error('Stack trace:', error.stack);
      
      try {
        await message.reply(`❌ An error occurred while fetching user information: ${error.message}`);
      } catch (replyError) {
        console.error('Could not send error message:', replyError);
      }
    }
  },
};

/**
 * Get key permissions for a member
 * @param member - Guild member
 * @returns Array of permission names
 */
function getKeyPermissions(member: GuildMember): string[] {
  const permissions = [];
  
  if (member.permissions.has('Administrator')) permissions.push('Administrator');
  if (member.permissions.has('ManageGuild')) permissions.push('Manage Server');
  if (member.permissions.has('ManageRoles')) permissions.push('Manage Roles');
  if (member.permissions.has('ManageChannels')) permissions.push('Manage Channels');
  if (member.permissions.has('BanMembers')) permissions.push('Ban Members');
  if (member.permissions.has('KickMembers')) permissions.push('Kick Members');
  if (member.permissions.has('ModerateMembers')) permissions.push('Timeout Members');
  if (member.permissions.has('ManageMessages')) permissions.push('Manage Messages');
  if (member.permissions.has('MentionEveryone')) permissions.push('Mention Everyone');
  if (member.permissions.has('ManageWebhooks')) permissions.push('Manage Webhooks');
  
  return permissions;
}

/**
 * Get acknowledgements/badges for a member
 * @param member - Guild member
 * @returns Array of acknowledgement strings
 */
function getAcknowledgements(member: GuildMember): string[] {
  const acknowledgements = [];
  
  // Server owner
  if (member.id === member.guild.ownerId) {
    acknowledgements.push('👑 Server Owner');
  }
  
  // Administrator
  if (member.permissions.has('Administrator')) {
    acknowledgements.push('⚡ Server Administrator');
  }
  
  // Server booster
  if (member.premiumSince) {
    acknowledgements.push('💎 Server Booster');
  }
  
  // Moderator (based on permissions)
  if (
    !member.permissions.has('Administrator') &&
    (member.permissions.has('BanMembers') || 
     member.permissions.has('KickMembers') || 
     member.permissions.has('ModerateMembers') ||
     member.permissions.has('ManageMessages'))
  ) {
    acknowledgements.push('🛡️ Server Moderator');
  }
  
  return acknowledgements;
}

