import { Context, Script } from 'node:vm';
import { Command } from '..';
import { CommandContext, MessageContext } from '../../context';
import { MessagePayloadOption } from 'discord.js';

export async function execute(ctx: CommandContext, code: string, context: Context = {}) {
    try {
        const message: string | MessagePayloadOption = await new Script(
            '(async () => {\n' +
            `    ${code}\n` +
            "    return 'Code executed.';" +
            '})()'
        ).runInNewContext({ ctx, ...context });
        await ctx.replyOrFollowUp(message);
    } catch (error) {
        if (Error.isError(error)) {
            await ctx.reply(error.toString(), { ephemeral: true });
        } else {
            await ctx.reply(`An error was thrown which was not an instance of Error.\n${error}`, { ephemeral: true });
        }
    }
}

export default {
    message: [
        {
            aliases: ['execute', 'exec'],
            isOwnerOnly: true,
            async execute(ctx: MessageContext) {
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
