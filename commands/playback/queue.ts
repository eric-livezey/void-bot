import { ActionRowBuilder, APIMessageTopLevelComponent, ButtonBuilder, ButtonStyle, InteractionContextType, JSONEncodable, MessageActionRowComponentBuilder, MessagePayloadOption, SlashCommandBuilder, TextDisplayBuilder } from 'discord.js';
import { Command } from '..';
import { CommandContext } from '../../context';
import { Player } from '../../player';
import { canViewPlayback } from './play';

export function generateQueueMessage(player: Player, page: number): MessagePayloadOption {
    const n = Math.max(Math.ceil(player.queue.length / 20) - 1, 0);
    if ((page + 1) * 20 > player.queue.length) {
        page = n;
    }
    if (page < 0) {
        page = 0;
    }
    const message = player.generateQueueMessage(page);
    if (message === null) {
        return { components: [new TextDisplayBuilder().setContent('Nothing is playing.')] };
    }
    const buttons = [];
    if (page > 0) {
        buttons.push(
            new ButtonBuilder()
                .setEmoji('\u2b05') // Left Arrow
                .setStyle(ButtonStyle.Secondary)
                .setCustomId(`QUEUE_PAGE:${page - 1}`)
        );
    }
    if (page < n) {
        buttons.push(
            new ButtonBuilder()
                .setEmoji('\u27a1') // Right Arrow
                .setStyle(ButtonStyle.Secondary)
                .setCustomId(`QUEUE_PAGE:${page + 1}`)
        );
    }
    if (buttons.length > 0) {
        ((message.components as JSONEncodable<APIMessageTopLevelComponent>[]) ??= []).push(
            new ActionRowBuilder<MessageActionRowComponentBuilder>()
                .addComponents(
                    ...buttons
                )
        );
    }
    return message;
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
