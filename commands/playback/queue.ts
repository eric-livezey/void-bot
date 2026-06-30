import { InteractionContextType, type MessagePayloadOption, SlashCommandBuilder } from 'discord.js';
import { CommandContext } from '../../context.js';
import { Player } from '../../player.js';
import type { Command } from '../index.js';
import { canViewPlayback } from './play.js';

export function generateQueueMessage(player: Player, page: number): MessagePayloadOption {
    const n = Math.max(Math.ceil(player.queue.length / 20) - 1, 0);
    if ((page + 1) * 20 > player.queue.length) {
        page = n;
    }
    if (page < 0) {
        page = 0;
    }
    return player.generateQueueMessage(page);
}

export async function queue(ctx: CommandContext<true>) {
    if (await canViewPlayback(ctx)) {
        const { player } = ctx;
        await ctx.reply(generateQueueMessage(player, 0));
    }
}

export default {
    interaction: {
        data: new SlashCommandBuilder()
            .setName('queue')
            .setDescription('Display the queue.')
            .setContexts(InteractionContextType.Guild),
        execute: queue,
    },
    message: [
        {
            aliases: ['queue', 'q'],
            isDmRestricted: true,
            execute: queue,
        }
    ]
} satisfies Command<true>;
