import { SlashCommandBuilder, SlashCommandStringOption } from 'discord.js';
import { evaluate } from 'mathjs';
import { MessageCommand, SlashCommand } from '../command.js';
import { CommandContext, MessageCommandContext, SlashCommandContext } from '../commandContext.js';
import type { CommandManagers } from '../commandManager.js';

export default async function execute(ctx: CommandContext, expression: string): Promise<void> {
    try {
        const result = evaluate(expression);
        if (typeof result !== 'function') {
            await ctx.reply(result.toLocaleString());
        } else {
            await ctx.reply('Cannot evaluate custom functions.');
        }
    } catch (error) {
        await ctx.reply(Error.isError(error) ? error.message : String(error));
    }
}

const slashCommand = new SlashCommand({
    data: new SlashCommandBuilder()
        .setName('evaluate')
        .setDescription('Evaluate a mathematical expression.')
        .addStringOption(new SlashCommandStringOption()
            .setName('expression')
            .setDescription('A mathematical expression.')
            .setRequired(true)),
    async execute(ctx: SlashCommandContext): Promise<void> {
        const options = ctx.interaction.options;

        const input = options.getString('expression', true);

        await execute(ctx, input);
    }
});
const messageCommand = new MessageCommand({
    aliases: ['evaluate', 'eval'],
    async execute(ctx: MessageCommandContext): Promise<void> {
        const [input] = ctx.getArguments(1);

        if (!input) {
            await ctx.reply('`expression` must be provided.');
            return;
        }

        await execute(ctx, input);
    }
});

export function registerEvaluateCommand({ slashCommands, messageCommands }: CommandManagers): void {
    slashCommands.register(slashCommand);
    messageCommands?.register(messageCommand);
}
