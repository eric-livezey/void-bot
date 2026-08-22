import { MessageCommand } from '../command.js';
import type { CommandContext, MessageCommandContext } from '../commandContext.js';
import type { CommandManagers } from '../commandManager.js';
import exec from './execute.js';

const REGEX = /^\n?```(?:js)?\n(.*(?:\n.*)*)\n```$/;

export default async function execute(ctx: CommandContext, input: string): Promise<void> {
    const match = input.match(REGEX);
    if (!match) {
        await ctx.reply('`code` is not of a valid format.');
        return;
    }

    await exec(ctx, match[1]!, {
        prettify: (input: string, format: string = '') => {
            return `\`\`\`${format}\n${input}\n\`\`\``;
        }
    });
}

const messageCommand = new MessageCommand({
    aliases: ['executepretty', 'executep', 'execp'],
    ownerOnly: true,
    async execute(ctx: MessageCommandContext): Promise<void> {
        const [input] = ctx.getArguments(1);

        if (!input) {
            await ctx.reply('`code` must be provided.');
            return;
        }

        await execute(ctx, input);
    }
});

export function registerExecutePrettyCommand({ messageCommands }: CommandManagers): void {
    messageCommands?.register(messageCommand);
}