import { ActionRowBuilder, ButtonBuilder, ButtonStyle, InteractionContextType, MessagePayloadOption, SlashCommandBuilder } from 'discord.js';
import { Command } from '..';
import { CommandContext } from '../../context';
import { Player } from '../../player';
import { canViewPlayback } from './play';

// NOTE: Maybe use components v2 instead of embed?
export function generateQueueMessage(player: Player, page: number): MessagePayloadOption {
    const n = Math.max(Math.ceil(player.queue.length / 25) - 1, 0);
    if ((page + 1) * 25 > player.queue.length) {
        page = n;
    }
    if (page < 0) {
        page = 0;
    }
    const embed = player.getEmbed(page);
    const arb = new ActionRowBuilder();
    if (page > 0) {
        arb.addComponents(
            new ButtonBuilder()
                .setEmoji('\u2b05') // Left Arrow
                .setStyle(ButtonStyle.Secondary)
                .setCustomId(`QUEUE_PAGE:${page - 1}`)
        );
    }
    if (page < n) {
        arb.addComponents(
            new ButtonBuilder()
                .setEmoji('\u27a1') // Right Arrow
                .setStyle(ButtonStyle.Secondary)
                .setCustomId(`QUEUE_PAGE:${page + 1}`)
        );
    }
    let content;
    if (embed === null) {
        content = 'Nothing is playing.'
    } else if (player.queue.length === 0) {
        content = '**Now Playing**:';
    }
    const embeds = [];
    if (embed !== null) {
        embeds.push(embed);
    }
    const components = [];
    if (arb.components.length > 0) {
        components.push(arb.toJSON());
    }
    return { content, embeds, components };
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
} as Command;
