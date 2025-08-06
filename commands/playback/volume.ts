import { InteractionContextType, PermissionsBitField, SlashCommandBuilder, SlashCommandNumberOption } from 'discord.js';
import { Command } from '..';
import { CommandContext, InteractionContext, MessageContext } from '../../context';

export async function volume(ctx: CommandContext<true>, percentage: number) {
    const { player } = ctx;
    player.setVolume(percentage / 100);
    ctx.reply(`Volume set to ${percentage}%.`);
}

const permissions = new PermissionsBitField([
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak
]).freeze();

export default {
    interaction: {
        data: new SlashCommandBuilder()
            .setName('volume')
            .setDescription('Set the volume of the player.')
            .addNumberOption(new SlashCommandNumberOption()
                .setName('percentage')
                .setDescription('Volume percentage.')
                .setMinValue(0)
                .setRequired(true))
            .setContexts(InteractionContextType.Guild)
            .setDefaultMemberPermissions(permissions.bitfield),
        async execute(ctx: InteractionContext<true>) {
            const percentage = ctx.interaction.options.getNumber('percentage', true);

            await volume(ctx, percentage);
        },
    },
    message: [
        {
            aliases: ['volume'],
            requiredPermissions: permissions,
            isDmRestricted: true,
            async execute(ctx: MessageContext<true>) {
                if (!ctx.member.permissions.has(permissions)) {
                    await ctx.reply('You must have permission to connect and speak to use this command.');
                    return;
                }

                const [input] = ctx.getArguments(1);

                if (!input) {
                    await ctx.reply('`percentage` must be provided.');
                    return;
                }

                if (!/^\d+(\.\d+)?$/.test(input)) {
                    await ctx.reply('`percentage` must be a number.');
                    return;
                }

                const percentage = parseFloat(input);

                if (percentage < 0) {
                    await ctx.reply('`percentage` must be greater than or equal to 0.');
                    return;
                }

                return await volume(ctx, percentage);
            },

        }
    ]
} as Command;
