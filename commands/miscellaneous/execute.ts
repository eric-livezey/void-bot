import { MessageFlags, type MessagePayloadOption } from 'discord.js';
import { type Context, Script, constants } from 'node:vm';
import { CommandContext, MessageCommandContext } from '../../context.js';
import type { Command } from '../index.js';

export async function execute(ctx: CommandContext, code: string, context: Context = {}) {
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

export default {
    message: [
        {
            aliases: ['execute', 'exec'],
            isOwnerOnly: true,
            async execute(ctx: MessageCommandContext) {
                const [input] = ctx.getArguments(1);

                if (!input) {
                    await ctx.reply('`code` must be provided.');
                    return;
                }

                await execute(ctx, input);
            }
        }
    ]
} satisfies Command;
