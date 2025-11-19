import { Client, GatewayIntentBits, Collection, Events } from 'discord.js';
import dotenv from 'dotenv';
import { readdir } from 'fs/promises';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { closeCasesDatabase } from './handlers/casesDb.js';
import { closeAppealsDatabase } from './handlers/appealsDb.js';
import { closeModActionsDatabase } from './handlers/modActionsDb.js';
import { closeTimezoneDatabase } from './handlers/timezoneDb.js';
import { startPunishmentCleanup } from './handlers/punishmentTracker.js';
import { createCooldownTracker, CooldownTracker, canAct, setCooldown, getRemainingCooldown } from './utils/cooldownManager.js';
import { startAllCleanupTasks, stopAllCleanupTasks } from './utils/cleanupScheduler.js';
import {
  processAutomodRules,
  processGeneralAutomod,
  handleAppealMessage,
} from './handlers/messageHandlers.js';
import { AUTOMOD_LOG_CHANNEL_ID } from './config.js';
import type { DiscordCommand } from './types/command.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env from project root (parent of src directory)
const envPath = join(__dirname, '..', '.env');
const result = dotenv.config({ path: envPath, override: true });

if (result.error) {
  console.error('Error loading .env:', result.error);
}

const PREFIX = process.env.PREFIX || 'v!';
const AUTHORIZED_USER_ID = '932320320222822400';


/**
 * Initialize Discord bot client with required intents
 */
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.GuildMembers,
  ],
});

// Extend client to hold commands
interface BotClient extends Client {
  commands: Collection<string, DiscordCommand>;
}

const botClient = client as BotClient;
botClient.commands = new Collection();

// Central per-command cooldowns
const commandCooldowns = new Map<string, CooldownTracker>();
function getCooldownTrackerFor(commandName: string, seconds: number): CooldownTracker {
  let tracker = commandCooldowns.get(commandName);
  if (!tracker) {
    tracker = createCooldownTracker(seconds * 1000);
    commandCooldowns.set(commandName, tracker);
  }
  return tracker;
}

// Track in-progress exclusive commands per user
const inProgressByCommand = new Map<string, Set<string>>();
function markInProgress(commandName: string, userId: string) {
  let set = inProgressByCommand.get(commandName);
  if (!set) {
    set = new Set();
    inProgressByCommand.set(commandName, set);
  }
  set.add(userId);
}
function clearInProgress(commandName: string, userId: string) {
  const set = inProgressByCommand.get(commandName);
  set?.delete(userId);
}
function isInProgress(commandName: string, userId: string): boolean {
  return inProgressByCommand.get(commandName)?.has(userId) ?? false;
}

/**
 * Load all command files from the commands directory
 */
async function loadCommands() {
  const commandsPath = join(__dirname, 'commands');
  const commandFiles = await readdir(commandsPath).catch(() => []);

  let loadedCount = 0;
  let aliasCount = 0;

  for (const file of commandFiles) {
    // Skip TypeScript declaration files and only load .js files (or .ts in dev)
    if (file.endsWith('.d.ts') || (!file.endsWith('.ts') && !file.endsWith('.js'))) continue;

    const filePath = join(commandsPath, file);
    try {
      const command = await import(`file://${filePath}`);
      if (command.default && command.default.name && command.default.execute) {
        const loaded = command.default as DiscordCommand;
        botClient.commands.set(loaded.name, loaded);
        loadedCount++;
        
        // Load aliases if they exist
        if (loaded.aliases && Array.isArray(loaded.aliases)) {
          for (const alias of loaded.aliases) {
            botClient.commands.set(alias, loaded);
            aliasCount++;
          }
        }
      }
    } catch (error) {
      console.error(`✗ Error loading command ${file}:`, error);
    }
  }

  console.log(`✓ Loaded ${loadedCount} commands (${aliasCount} aliases).`);
}

/**
 * Event: Bot is ready
 */
client.once(Events.ClientReady, async () => {
  console.log(`✓ Bot logged in as ${client.user?.tag}`);
  
  // Start all cleanup tasks
  startPunishmentCleanup();
  startAllCleanupTasks();
});

/**
 * Event: Message received (prefix commands and automod)
 */
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;

  // Check tiered automod rules (spam, mentions, zalgo, emoji, invites)
  if (await processAutomodRules(message, client, AUTOMOD_LOG_CHANNEL_ID)) {
    return; // Message was deleted by automod
  }
  
  // Check general automod (inappropriate content, blacklist, sequence detection, link mute)
  if (await processGeneralAutomod(message, client, AUTOMOD_LOG_CHANNEL_ID)) {
    return; // Message was deleted by automod
  }

  // Handle appeal messages in DMs (if user has active appeal session)
  if (await handleAppealMessage(message, botClient.commands)) {
    return; // Appeal message was handled
  }

  // Handle prefix commands
  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const commandName = args.shift()?.toLowerCase();

  if (!commandName) return;

  const command = botClient.commands.get(commandName);
  if (!command) return;

  // Check authorization - only AUTHORIZED_USER_ID can use commands
  if (message.author.id !== AUTHORIZED_USER_ID) {
    await message.reply('❌ You do not have permission to use bot commands.');
    return;
  }

  try {
    // Enforce central cooldowns if defined
    if (command.cooldownSeconds && command.cooldownSeconds > 0) {
      const tracker = getCooldownTrackerFor(command.name, command.cooldownSeconds);
      if (!canAct(tracker, message.author.id)) {
        const remaining = Math.ceil(getRemainingCooldown(tracker, message.author.id) / 1000);
        await message.reply(`⏳ Please wait ${remaining}s before using this command again.`);
        return;
      }
    }

    // Enforce exclusive per-user execution if defined
    if (command.exclusivePerUser && isInProgress(command.name, message.author.id)) {
      await message.reply('⏳ Your previous request is still processing. Please wait a moment.');
      return;
    }

    if (command.exclusivePerUser) {
      markInProgress(command.name, message.author.id);
    }

    await command.execute(message, args);

    if (command.cooldownSeconds && command.cooldownSeconds > 0) {
      const tracker = getCooldownTrackerFor(command.name, command.cooldownSeconds);
      setCooldown(tracker, message.author.id);
    }
  } catch (error) {
    console.error('Error executing command:', error);
    await message.reply({
      content: 'There was an error executing this command!',
    });
  } finally {
    if (command.exclusivePerUser) {
      clearInProgress(command.name, message.author.id);
    }
  }
});



/**
 * Handle graceful shutdown
 */
async function gracefulShutdown() {
  if ((global as any).__isShuttingDown) return;
  (global as any).__isShuttingDown = true;
  console.log('\n✓ Shutting down gracefully...');
  stopAllCleanupTasks();
  closeCasesDatabase();
  closeAppealsDatabase();
  closeModActionsDatabase();
  closeTimezoneDatabase();
  await client.destroy();
  process.exit(0);
}

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

// Process-level error guards
process.on('unhandledRejection', (reason: any) => {
  console.error('Unhandled promise rejection:', reason);
  gracefulShutdown();
});

process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  gracefulShutdown();
});

/**
 * Main bot startup function
 */
async function main() {
  let token = process.env.DISCORD_TOKEN?.trim();

  if (!token || token === 'your_bot_token_here') {
    console.error('❌ Error: DISCORD_TOKEN is not set or is the placeholder value');
    console.error('Please add your bot token to the .env file:');
    console.error('DISCORD_TOKEN=your_actual_token_here');
    process.exit(1);
  }

  // Remove any quotes that might be wrapping the token
  token = token.replace(/^["']|["']$/g, '');

  await loadCommands();
  console.log(`✓ Commands loaded. Using prefix: ${PREFIX}`);
  await client.login(token);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

