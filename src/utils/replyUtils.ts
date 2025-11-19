import { Message, TextChannel, DMChannel, NewsChannel } from 'discord.js';

type SendableChannel = TextChannel | DMChannel | NewsChannel | (TextChannel & { send: any });

/**
 * Reply with an auto-deleting message in the same channel.
 */
export async function replyWithAutoDelete(
  channel: SendableChannel,
  content: string,
  deleteAfterMs: number
): Promise<void> {
  const sent = await (channel as any).send(content);
  setTimeout(() => {
    sent.delete().catch(() => {});
  }, deleteAfterMs);
}


