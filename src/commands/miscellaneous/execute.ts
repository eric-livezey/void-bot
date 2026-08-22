import { MessageFlags, type MessagePayloadOption } from 'discord.js';
import { Script, constants, type Context } from 'node:vm';
import { MessageCommand } from '../command.js';
import type { CommandContext, MessageCommandContext } from '../commandContext.js';
import type { CommandManagers } from '../commandManager.js';

export default async function execute(ctx: CommandContext, code: string, context: Context = {}): Promise<void> {
    try {
        const message: string | MessagePayloadOption = await new Script(
            '(async () => {\n' +
            `    ${code}\n` +
            "    return 'Code executed.';" +
            '})()',
            { importModuleDynamically: constants.USE_MAIN_CONTEXT_DEFAULT_LOADER }
        ).runInNewContext({ ctx, ...context });
        await ctx.replyOrFollowUp(message);
    } catch (error) {
        if (Error.isError(error)) {
            await ctx.reply({ flags: MessageFlags.Ephemeral, content: error.toString() });
        } else {
            await ctx.reply({ flags: MessageFlags.Ephemeral, content: `An error was thrown which was not an instance of Error.\n${error}` });
        }
    }
}

const messageCommand = new MessageCommand({
    aliases: ['execute', 'exec'],
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

export function registerExecuteCommand({ messageCommands }: CommandManagers): void {
    messageCommands?.register(messageCommand);
}
