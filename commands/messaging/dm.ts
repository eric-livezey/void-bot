import { type MessageCreateOptions, MessageFlags, PermissionsBitField, SlashCommandAttachmentOption, SlashCommandBuilder, SlashCommandStringOption, SlashCommandUserOption, User } from 'discord.js';
import { CommandContext, MessageCommandContext, SlashCommandContext } from '../../context.js';
import { resolveUserId } from '../../utils.js';
import type { Command } from '../index.js';

export async function dm(ctx: CommandContext, user: User, options: MessageCreateOptions) {
    try {
        if (ctx.isSlashCommand()) {
            await ctx.deferReply();
        }
        const channel = await user.createDM();
        await channel.send(options);
        await ctx.reply(options);
    } catch (error) {
        await ctx.replyOrFollowUp({ flags: MessageFlags.Ephemeral, content: (error as Error).message + '.'});
    }
}

export default {
    interaction: {
        data: new SlashCommandBuilder()
            .setName('dm')
            .setDescription('Send a direct message.')
            .addUserOption(new SlashCommandUserOption()
                .setName('user')
                .setDescription('The user to DM.')
                .setRequired(true))
            .addStringOption(new SlashCommandStringOption()
                .setName('content')
                .setDescription('Message content')
                .setMaxLength(2000))
            .addAttachmentOption(new SlashCommandAttachmentOption()
                .setName('attachment')
                .setDescription('Message attachment'))
            .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
        isGuildCommand: true,
        async execute(ctx: SlashCommandContext) {
            const options = ctx.interaction.options;

            const user = options.getUser('user', true);
            const content = options.getString('content') ?? undefined;
            const attachments = [];
            const attachment = options.getAttachment('attachment') ?? undefined;
            if (attachment) {
                attachments.push(attachment);
            }

            await dm(ctx, user, { content, files: attachments.map(attachment => attachment.url) });
        }
    },
    message: [
        {
            aliases: ['dm'],
            isOwnerOnly: true,
            async execute(ctx: MessageCommandContext) {
                const [userParam, content] = ctx.getArguments(2);
                const attachments = ctx.message.attachments;

                if (!userParam) {
                    await ctx.reply('You must provide a text channel.');
                    return;
                }

                const userId = resolveUserId(userParam);
                const user = userId ? ctx.client.users.resolve(userId) : null;

                if (!user) {
                    await ctx.reply('The first argument must reference a valid user.');
                    return;
                }

                await dm(ctx, user, { content, files: attachments.map(attachment => attachment.url) });
            }
        }
    ]
} satisfies Command
