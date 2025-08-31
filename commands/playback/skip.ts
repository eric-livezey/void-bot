import { InteractionContextType, PermissionsBitField, SlashCommandBuilder, SlashCommandIntegerOption } from 'discord.js';
import { Command } from '..';
import { CommandContext, InteractionContext, MessageContext } from '../../context';
import { canManagePlayback } from './play';

export async function skip(ctx: CommandContext<true>, count?: number) {
    if (await canManagePlayback(ctx)) {
        const { player } = ctx;
        if (count == null) {
            const track = await player.skip();
            if (track) {
                await ctx.reply({ content: '**Skipped**:', embeds: [track.toEmbed()] });
            } else {
                await ctx.reply('Nothing is playing.');
            }
        } else {
            const { length } = player.queue.splice(0, count - 1);
            const track = await player.skip();
            if (track) {
                await ctx.reply(`Skipped ${length + 1} tracks.`);
            } else {
                await ctx.reply('Nothing is playing.');
            }
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
            .setName('skip')
            .setDescription('Skip the current track.')
            .addIntegerOption(new SlashCommandIntegerOption()
                .setName('count')
                .setDescription('The number of tracks to skip.')
                .setMinValue(1))
            .setContexts(InteractionContextType.Guild)
            .setDefaultMemberPermissions(permissions.bitfield),
        async execute(ctx: InteractionContext<true>) {
            const options = ctx.interaction.options;

            const count = options.getInteger('count') ?? undefined;

            await skip(ctx, count);
        },
    },
    message: [
        {
            aliases: ['skip'],
            requiredPermissions: permissions,
            isDmRestricted: true,
            async execute(ctx: MessageContext<true>) {
                const [input] = ctx.getArguments(1);

                let count;
                if (input) {
                    if (!/^\d+$/.test(input)) {
                        await ctx.reply('`count` must be an integer.');
                        return;
                    }
                    count = parseInt(input);
                    if (count <= 0) {
                        await ctx.reply('`count` must be greater than 0.');
                        return;
                    }
                }

                return await skip(ctx, count);
            },
        }
    ]
} as Command;
