import { InteractionContextType, PermissionsBitField, SlashCommandBuilder, SlashCommandIntegerOption } from 'discord.js';
import { Command } from '..';
import { CommandContext, InteractionContext, MessageContext } from '../../context';
import { nowPlaying } from './nowplaying';
import { canViewPlayback } from './play';

export async function info(ctx: CommandContext<true>, index: number) {
    if (index === 0) {
        await nowPlaying(ctx);
    } else if (await canViewPlayback(ctx)) {
        const { player } = ctx;
        if (index <= player.queue.length) {
            const track = player.queue.get(index - 1);
            if (track) {
                await ctx.reply({ embeds: [track.toEmbed()] });
            } else {
                await ctx.reply('`index` must be less than or equal to the length of the queue.', true);
            }
        } else {
            await ctx.reply('`index` must be less than or equal to the length of the queue.', true);
        }
    }
}

const permissions = new PermissionsBitField([
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak,
]).freeze();

export default {
    interaction: {
        data: new SlashCommandBuilder()
            .setName('info')
            .setDescription('Display the track at the given index in the queue.')
            .addIntegerOption(new SlashCommandIntegerOption()
                .setName('index')
                .setDescription('An index of a track in the queue.')
                .setMinValue(0)
                .setRequired(true))
            .setContexts(InteractionContextType.Guild)
            .setDefaultMemberPermissions(permissions.bitfield),
        async execute(ctx: InteractionContext<true>) {
            const index = ctx.interaction.options.getInteger('index', true);

            await info(ctx, index);
        },
    },
    message: [
        {
            aliases: ['info', 'i'],
            requiredPermissions: permissions,
            isDmRestricted: true,
            async execute(ctx: MessageContext<true>) {
                const [input] = ctx.getArguments(1);

                if (!input) {
                    await ctx.reply('`index` must be provided.');
                    return;
                }

                if (!/^\d+$/.test(input)) {
                    await ctx.reply('`index` must be an integer.');
                    return;
                }

                const index = parseInt(input);

                if (index < 0) {
                    await ctx.reply('`index` must be greater than or equal to 0.');
                    return;
                }

                return await info(ctx, index);
            },
        }
    ]
} as Command;
