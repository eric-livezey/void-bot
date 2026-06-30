import { MessageCommandContext } from '../../context.js';
import type { Command } from '../index.js';
import { execute } from './execute.js';

const REGEX = /^\n?```(?:js)?\n(.*(?:\n.*)*)\n```$/;

export default {
    message: [
        {
            aliases: ['executepretty', 'executep', 'execp'],
            isOwnerOnly: true,
            async execute(ctx: MessageCommandContext) {
                const [input] = ctx.getArguments(1);

                if (!input) {
                    await ctx.reply('`code` must be provided.');
                    return;
                }

                const match = input.match(REGEX);
                if (!match) {
                    await ctx.reply('`code` is not of a valid format.');
                    return;
                }

                await execute(ctx, match[1]!, {
                    prettify: (input: string, format: string = '') => {
                        return `\`\`\`${format}\n${input}\n\`\`\``;
                    }
                });
            }
        }
    ]
} satisfies Command;