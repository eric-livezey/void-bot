import { ChannelType, MessageCreateOptions, PermissionsBitField, SendableChannels, SlashCommandAttachmentOption, SlashCommandBuilder, SlashCommandChannelOption, SlashCommandStringOption } from "discord.js";
import { Command } from "..";
import { CommandContext, InteractionContext, MessageContext } from "../../context";
import { resolveChannelId } from "../../utils";

const CHANNEL_TYPES = [
    ChannelType.GuildText,
    ChannelType.GuildVoice,
    ChannelType.GuildAnnouncement,
    ChannelType.AnnouncementThread,
    ChannelType.PublicThread,
    ChannelType.PrivateThread,
    ChannelType.GuildStageVoice
] as const;

export async function send(ctx: CommandContext, channel: SendableChannels, options: MessageCreateOptions) {
    try {
        await channel.send(options);
        await ctx.reply('Message sent.');
    } catch (error) {
        await ctx.replyOrFollowUp((error as Error).message + '.', true)
    }
}

export default {
    interaction: {
        data: new SlashCommandBuilder()
            .setName('send')
            .setDescription('Send a message.')
            .addChannelOption(new SlashCommandChannelOption()
                .setName('channel')
                .setDescription('The channel to send the message to')
                .setRequired(true)
                .addChannelTypes(...CHANNEL_TYPES))
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
            const interaction = ctx.interaction;

            if (interaction.inCachedGuild()) {
                const options = interaction.options;
                const channel = options.getChannel('channel', true, CHANNEL_TYPES);
                const content = options.getString('content') ?? undefined;
                const attachments = [];
                const attachment = options.getAttachment('attachment') ?? undefined;
                if (attachment) {
                    attachments.push(attachment);
                }

                await send(ctx, channel, { content, files: attachments.map(attachment => attachment.url) });
            }
        }
    },
    message: [
        {
            aliases: ['send'],
            isOwnerOnly: true,
            async execute(ctx: MessageContext) {
                const [channelParam, content] = ctx.getArguments(2);
                const attachments = ctx.message.attachments;

                if (!channelParam) {
                    await ctx.reply('You must provide a text channel.');
                    return;
                }

                const channelId = resolveChannelId(channelParam);
                const channel = channelId ? ctx.client.channels.resolve(channelId) : null;

                if (!channel || !channel.isSendable()) {
                    await ctx.reply('The first argument must reference a valid text channel.');
                    return;
                }

                await send(ctx, channel, { content, files: attachments.map(attachment => attachment.url) });
            }
        }
    ]
} as Command;
