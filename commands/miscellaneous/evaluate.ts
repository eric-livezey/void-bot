import { SlashCommandBuilder, SlashCommandStringOption } from 'discord.js';
import { evaluate } from 'mathjs';
import { Command } from '..';
import { CommandContext, InteractionContext, MessageContext } from '../../context';

export async function execute(ctx: CommandContext, expression: string) {
    try {
        const result = evaluate(expression);
        if (typeof result !== 'function') {
            await ctx.reply(result.toLocaleString());
        } else {
            await ctx.reply('Cannot evaluate custom functions.');
        }
    } catch (error) {
        await ctx.reply((error as Error).message);
    }
}

export default {
    interaction: {
        data: new SlashCommandBuilder()
            .setName('evaluate')
            .setDescription('Evaluate a mathematical expression.')
            .addStringOption(new SlashCommandStringOption()
                .setName('expression')
                .setDescription('A mathematical expression.')
                .setRequired(true)),
        async execute(ctx: InteractionContext) {
            const options = ctx.interaction.options;

            const input = options.getString('expression', true);

            await execute(ctx, input);
        }
    },
    message: [
        {
            aliases: ['evaluate', 'eval'],
            isDmRestricted: true,
            async execute(ctx: MessageContext) {
                const [input] = ctx.getArguments(1);

                if (!input) {
                    await ctx.reply('`expression` must be provided.');
                    return;
                }

                await execute(ctx, input);
            }
        }
    ]
} as Command;
