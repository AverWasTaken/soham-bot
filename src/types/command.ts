import { Message } from 'discord.js';

export interface DiscordCommand {
  name: string;
  aliases?: string[];
  description?: string;
  execute(message: Message, args: string[]): Promise<void>;
  // Optional handler for message-based flows (e.g., appeals in DMs)
  handleMessage?(message: Message): Promise<boolean>;
  // Optional per-user cooldown in seconds, enforced centrally
  cooldownSeconds?: number;
  // If true, prevents concurrent executions per user until the previous finishes
  exclusivePerUser?: boolean;
}


