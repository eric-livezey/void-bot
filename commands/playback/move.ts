import { InteractionContextType, MessageFlags, PermissionsBitField, SlashCommandBuilder, SlashCommandIntegerOption } from 'discord.js';
import { Command } from '..';
import { CommandContext, InteractionContext, MessageContext } from '../../context';
import { canManagePlayback } from './play';

export async function move(ctx: CommandContext<true>, source: number, destination: number) {
    if (await canManagePlayback(ctx)) {
        const { queue } = ctx.player;
        if (queue.length === 0) {
            return await ctx.reply('The queue is empty.');
        }
        if (source < 1 || source > queue.length) {
            await ctx.reply(`${source} is not a valid index in the queue.`);
            return;
        }
        if (destination < 1 || destination > queue.length) {
            await ctx.reply(`${destination} is not a valid index in the queue.`);
            return;
        }
        if (source === destination) {
            await ctx.reply('Indices must not be equal.');
            return;
        }
        const track = queue.get(source - 1);
        queue.move(source - 1, destination - 1);
        return await ctx.reply({
            content: `Moved **${track.url ? `[${track.title}](${track.url})` : track.title}** to index ${destination} in the queue.`,
            flags: [MessageFlags.SuppressEmbeds],
        });
    }
}

const permissions = new PermissionsBitField([
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak,
]).freeze();

export default {
    interaction: {
        data: new SlashCommandBuilder()
            .setName('move')
            .setDescription('Move a track in the queue.')
            .addIntegerOption(new SlashCommandIntegerOption()
                .setName('source')
                .setDescription('The index of the track to move.')
                .setMinValue(1)
                .setRequired(true))
            .addIntegerOption(new SlashCommandIntegerOption()
                .setName('destination')
                .setDescription('The index to move the track to.')
                .setMinValue(1)
                .setRequired(true))
            .setContexts(InteractionContextType.Guild)
            .setDefaultMemberPermissions(permissions.bitfield),
        async execute(ctx: InteractionContext<true>) {
            const { options } = ctx.interaction;

            const source = options.getInteger('source', true);
            const destination = options.getInteger('destination', true);

            return await move(ctx, source, destination);
        }
    },
    message: [
        {
            aliases: ['move', 'mv'],
            requiredPermissions: permissions,
            isDmRestricted: true,
            async execute(ctx: MessageContext<true>) {
                const [sourceInput, destinationInput] = ctx.getArguments(2);

                if (!sourceInput || !destinationInput) {
                    await ctx.reply('Both `source` and `destination` must be provided.');
                    return;
                }

                if (!/^\d+$/.test(sourceInput) || !/^\d+$/.test(destinationInput)) {
                    await ctx.reply('Both `source` and `destination` must be integers.');
                    return;
                }

                const source = parseInt(sourceInput);
                const destination = parseInt(destinationInput);

                if (source <= 0 || destination <= 0) {
                    await ctx.reply('Both `source` and `destination` must be greater than 0.');
                    return;
                }

                return await move(ctx, source, destination);
            }
        }
    ]
} as Command;
