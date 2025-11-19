/**
 * Appeal command - Submit an appeal for a punishment
 * Usage: v!appeal (in DMs only)
 * 
 * Guides users through a series of questions and submits the appeal to staff
 */

import { EmbedBuilder, Message, TextChannel } from 'discord.js';
import { addAppeal, getPendingAppealsForUser } from '../handlers/appealsDb.js';
import { getRecentPunishment, clearTrackedPunishment } from '../handlers/punishmentTracker.js';
import { getPrefix } from '../config.js';

// Appeal channel and role IDs
const APPEAL_CHANNEL_ID = '1430325683514511380';
const APPEAL_PING_ROLE_ID = '1413096630777020456';

// Track users currently in appeal process
const activeAppeals = new Map<string, {
  step: number;
  answers: {
    punishmentType: string;
    punishmentReason: string;
    appealReason?: string;
    whatHappened?: string;
    whyUnpunish?: string;
    preventFuture?: string;
  };
  guildId: string;
  guildName: string;
  timeoutId: NodeJS.Timeout;
}>();

// Questions for the appeal (punishment info is pre-filled)
const QUESTIONS = [
  {
    question: 'Why do you want to appeal this punishment?',
    description: 'Briefly explain your main reason for appealing',
    field: 'appealReason' as const,
  },
  {
    question: 'What happened from your perspective?',
    description: 'Explain the situation that led to your punishment',
    field: 'whatHappened' as const,
  },
  {
    question: 'Why should we remove or reduce your punishment?',
    description: 'Make your case for why the punishment should be lifted',
    field: 'whyUnpunish' as const,
  },
  {
    question: 'How will you prevent this from happening again?',
    description: 'What steps will you take to avoid future rule violations?',
    field: 'preventFuture' as const,
  },
];

// Timeout duration for appeal process (15 minutes)
const APPEAL_TIMEOUT = 15 * 60 * 1000;

/**
 * Clean up an active appeal session
 * @param userId - User ID to clean up
 */
function cleanupAppeal(userId: string) {
  const appeal = activeAppeals.get(userId);
  if (appeal) {
    clearTimeout(appeal.timeoutId);
    activeAppeals.delete(userId);
  }
}

/**
 * Start or continue an appeal process
 * @param message - The message from the user
 */
async function handleAppealMessage(message: Message) {
  const userId = message.author.id;
  const appeal = activeAppeals.get(userId);

  if (!appeal) {
    // This shouldn't happen as we create the appeal session in execute()
    return;
  }

  // Reset timeout
  clearTimeout(appeal.timeoutId);
  appeal.timeoutId = setTimeout(() => {
    cleanupAppeal(userId);
    message.author.send(`⏱️ Your appeal session has timed out due to inactivity. Please run \`${getPrefix()}appeal\` again to start over.`).catch(() => {});
  }, APPEAL_TIMEOUT);

  const currentQuestion = QUESTIONS[appeal.step];
  const answer = message.content.trim();

  // Validate answer length
  if (answer.length === 0) {
    await message.reply('❌ Please provide an answer. Your response cannot be empty.');
    return;
  }

  if (answer.length > 1000) {
    await message.reply('❌ Your response is too long. Please keep it under 1000 characters.');
    return;
  }

  // Store the answer
  appeal.answers[currentQuestion.field] = answer;

  appeal.step++;

  // Check if we have more questions
  if (appeal.step < QUESTIONS.length) {
    const nextQuestion = QUESTIONS[appeal.step];
    const embed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`Appeal Question ${appeal.step + 1}/${QUESTIONS.length}`)
      .setDescription(`**${nextQuestion.question}**\n\n${nextQuestion.description}`)
      .setFooter({ text: 'You have 15 minutes to complete this appeal' });

    await message.reply({ embeds: [embed] });
  } else {
    // All questions answered, submit appeal
    await submitAppeal(message, appeal);
    
    // Clear tracked punishment after successful appeal submission
    clearTrackedPunishment(userId);
    cleanupAppeal(userId);
  }
}

/**
 * Submit the completed appeal
 * @param message - The message from the user
 * @param appeal - The appeal data
 */
async function submitAppeal(message: Message, appeal: NonNullable<ReturnType<typeof activeAppeals.get>>) {
  try {
    // Save to database
    const appealId = addAppeal({
      userId: message.author.id,
      userTag: message.author.tag,
      guildId: appeal.guildId,
      guildName: appeal.guildName,
      punishmentType: appeal.answers.punishmentType!,
      punishmentReason: appeal.answers.punishmentReason!,
      appealReason: appeal.answers.appealReason!,
      whatHappened: appeal.answers.whatHappened!,
      whyUnpunish: appeal.answers.whyUnpunish!,
      preventFuture: appeal.answers.preventFuture!,
    });

    // Send to user
    const userEmbed = new EmbedBuilder()
      .setColor(0x00FF00)
      .setTitle('Appeal Submitted')
      .setDescription('Your appeal has been submitted to the staff team.')
      .addFields(
        { name: 'Appeal ID', value: appealId, inline: false },
        { name: 'Status', value: 'Pending Review', inline: false }
      )
      .setFooter({ text: 'You will be notified when your appeal is reviewed' })
      .setTimestamp();

    await message.reply({ embeds: [userEmbed] });

    // Send to staff channel
    const staffEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('New Appeal Submitted')
      .setDescription(`<@${message.author.id}> (${message.author.tag}) has submitted an appeal`)
      .addFields(
        { name: 'Appeal ID', value: `\`${appealId}\``, inline: true },
        { name: 'User', value: `<@${message.author.id}>`, inline: true },
        { name: 'User ID', value: message.author.id, inline: true },
        { name: 'Punishment Type', value: appeal.answers.punishmentType!, inline: true },
        { name: 'Original Reason', value: appeal.answers.punishmentReason!, inline: true },
        { name: 'Status', value: 'Pending', inline: true },
        { name: 'Why Appeal?', value: appeal.answers.appealReason!, inline: false },
        { name: 'What Happened?', value: appeal.answers.whatHappened!.substring(0, 1024), inline: false },
        { name: 'Why Unpunish?', value: appeal.answers.whyUnpunish!.substring(0, 1024), inline: false },
        { name: 'Prevent Future?', value: appeal.answers.preventFuture!.substring(0, 1024), inline: false }
      )
      .setFooter({ text: `Use ${getPrefix()}acceptappeal ${appealId} or ${getPrefix()}denyappeal ${appealId}` })
      .setTimestamp();

    // Get appeal channel
    const appealChannel = await message.client.channels.fetch(APPEAL_CHANNEL_ID).catch(() => null) as TextChannel | null;

    if (appealChannel) {
      await appealChannel.send({
        content: `<@&${APPEAL_PING_ROLE_ID}>`,
        embeds: [staffEmbed],
      });
    } else {
      console.error('❌ Appeal channel not found');
    }

    console.log(`✓ Appeal ${appealId} submitted by ${message.author.tag}`);
  } catch (error) {
    console.error('Error submitting appeal:', error);
    await message.reply('❌ An error occurred while submitting your appeal. Please try again later or contact a staff member.');
  }
}

export default {
  name: 'appeal',
  description: 'Submit an appeal for a punishment (DM only)',

  /**
   * Execute the appeal command
   * @param message - The message that triggered the command
   */
  async execute(message: Message) {
    // Must be in DMs
    if (message.guild) {
      await message.reply('❌ This command can only be used in DMs. Please send me a direct message to start an appeal.');
      return;
    }

    const userId = message.author.id;

    // Check if user already has an active appeal session
    if (activeAppeals.has(userId)) {
      await message.reply('⚠️ You already have an appeal in progress. Please answer the current question or wait 15 minutes for it to time out.');
      return;
    }

    // Check if user has pending appeals (limit to 1 pending appeal at a time)
    const pendingAppeals = getPendingAppealsForUser(userId);
    if (pendingAppeals.length > 0) {
      const appealIds = pendingAppeals.map(a => `\`${a.appealId}\``).join(', ');
      await message.reply(`⚠️ You already have ${pendingAppeals.length} pending appeal(s): ${appealIds}\n\nPlease wait for your current appeal(s) to be reviewed before submitting a new one.`);
      return;
    }

    // Get recent punishment for this user
    const recentPunishment = getRecentPunishment(userId);
    
    if (!recentPunishment) {
      await message.reply('❌ No recent punishment found. Appeals are only available for punishments issued in the last 30 days.\n\nIf you believe this is an error, please contact a server administrator directly.');
      return;
    }

    // Start appeal session with pre-filled punishment info
    const timeoutId = setTimeout(() => {
      cleanupAppeal(userId);
      message.author.send(`⏱️ Your appeal session has timed out due to inactivity. Please run \`${getPrefix()}appeal\` again to start over.`).catch(() => {});
    }, APPEAL_TIMEOUT);

    activeAppeals.set(userId, {
      step: 0,
      answers: {
        punishmentType: recentPunishment.punishmentType,
        punishmentReason: recentPunishment.reason,
      },
      guildId: recentPunishment.guildId,
      guildName: recentPunishment.guildName,
      timeoutId,
    });

    // Send welcome message with punishment info and first question
    const welcomeEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle('Appeal Process Started')
      .setDescription(
        `You are about to submit an appeal for **${recentPunishment.guildName}**.\n\n` +
        `**Your Punishment:**\n` +
        `• **Type:** ${recentPunishment.punishmentType.toUpperCase()}\n` +
        `• **Reason:** ${recentPunishment.reason}\n` +
        `• **Date:** <t:${Math.floor(recentPunishment.timestamp / 1000)}:F>\n\n` +
        `You will be asked ${QUESTIONS.length} questions. Please answer each question honestly and thoroughly.\n\n` +
        `**Important:**\n` +
        `• You have 15 minutes to complete this appeal\n` +
        `• Keep each response under 1000 characters\n` +
        `• You can only have 1 pending appeal at a time\n` +
        `• False information may result in appeal denial`
      )
      .setTimestamp();

    const firstQuestion = QUESTIONS[0];
    const questionEmbed = new EmbedBuilder()
      .setColor(0x5865F2)
      .setTitle(`Appeal Question 1/${QUESTIONS.length}`)
      .setDescription(`**${firstQuestion.question}**\n\n${firstQuestion.description}`)
      .setFooter({ text: 'You have 15 minutes to complete this appeal' });

    await message.reply({ embeds: [welcomeEmbed, questionEmbed] });
  },

  /**
   * Handle messages during appeal process
   * @param message - The message from the user
   */
  async handleMessage(message: Message) {
    // Check if this user has an active appeal session
    if (activeAppeals.has(message.author.id)) {
      await handleAppealMessage(message);
      return true;
    }
    return false;
  },
};

