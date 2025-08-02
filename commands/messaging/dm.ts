import { MessageCreateOptions, PermissionsBitField, SlashCommandAttachmentOption, SlashCommandBuilder, SlashCommandStringOption, SlashCommandUserOption, User } from "discord.js";
import { Command } from "..";
import { CommandContext, InteractionContext, MessageContext } from "../../context";
import { resolveUserId } from "../../utils";

export async function dm(ctx: CommandContext, user: User, options: MessageCreateOptions) {
    try {
        const channel = await user.createDM();
        await channel.send(options);
        await ctx.reply(options);
    } catch (error) {
        await ctx.replyOrFollowUp((error as Error).message + '.', true);
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
        async execute(ctx: InteractionContext) {
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
            async execute(ctx: MessageContext) {
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
} as Command
