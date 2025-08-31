import { Script } from 'node:vm';
import { Command } from '..';
import { CommandContext, MessageContext } from '../../context';

export async function execute(ctx: CommandContext, code: string) {
    try {
        const script = new Script(code);
        script.runInThisContext();
        await ctx.replyOrFollowUp('Code executed.');
    } catch (error) {
        if (error instanceof Error) {
            await ctx.reply(error.toString(), true);
        } else {
            await ctx.reply('An error was thrown which was not an instance of Error.', true);
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
} as Command;
