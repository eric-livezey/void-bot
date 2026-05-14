import { InteractionContextType, PermissionsBitField, SlashCommandBuilder, SlashCommandIntegerOption } from 'discord.js';
import { Command } from '..';
import { CommandContext, InteractionContext, MessageContext } from '../../context';
import { canManagePlayback } from './play';

export async function remove(ctx: CommandContext<true>, index: number) {
    if (await canManagePlayback(ctx)) {
        const { queue } = ctx.player;
        if (queue.length === 0) {
            await ctx.reply('The queue is empty.');
            return;
        }
        if (index < 1 || index > queue.length) {
            await ctx.reply(`${index} is not a valid index in the queue.`,);
            return;
        }
        const track = queue.remove(index - 1);
        const { embed, files } = track.toEmbed();
        await ctx.reply({ content: '**Removed**:', embeds: [embed], files });
    }
}

const permissions = new PermissionsBitField([
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak,
]).freeze();

export default {
    interaction: {
        data: new SlashCommandBuilder()
            .setName('remove')
            .setDescription('Remove a track from the queue.')
            .addIntegerOption(new SlashCommandIntegerOption()
                .setName('index')
                .setDescription('The index of the track to remove.')
                .setMinValue(1)
                .setRequired(true))
            .setContexts(InteractionContextType.Guild)
            .setDefaultMemberPermissions(permissions.bitfield),
        async execute(ctx: InteractionContext<true>) {
            const { options } = ctx.interaction;

            const index = options.getInteger('index', true);

            await remove(ctx, index);
        }
    },
    message: [
        {
            aliases: ['remove', 'rm'],
            requiredPermissions: permissions,
            isDmRestricted: true,
            async execute(ctx: MessageContext<true>) {
                const [indexInput] = ctx.getArguments(1);

                if (!indexInput) {
                    await ctx.reply('`index` must be provided.');
                    return;
                }

                if (!/^\d+$/.test(indexInput)) {
                    await ctx.reply('`index` must be an integer.');
                    return;
                }

                const index = parseInt(indexInput);

                if (index <= 0) {
                    await ctx.reply('`index` must be greater than 0.');
                    return;
                }

                await remove(ctx, index);
            }
        }
    ]
} satisfies Command<true>;
