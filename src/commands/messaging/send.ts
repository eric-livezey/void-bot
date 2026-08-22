import { ChannelType, type MessageCreateOptions, MessageFlags, PermissionsBitField, type SendableChannels, SlashCommandAttachmentOption, SlashCommandBuilder, SlashCommandChannelOption, SlashCommandStringOption } from 'discord.js';
import { type ConfigOptions, normalizeOptions, resolveChannelId } from '../../utils.js';
import { MessageCommand, SlashCommand } from '../command.js';
import { CommandContext, MessageCommandContext, SlashCommandContext } from '../commandContext.js';

import config from '../../../config.json' with { type: 'json' };
import type { CommandManagers } from '../commandManager.js';

const { guildId: GUILD_ID } = config as ConfigOptions;
const CHANNEL_TYPES = [
    ChannelType.GuildText,
    ChannelType.GuildVoice,
    ChannelType.GuildAnnouncement,
    ChannelType.AnnouncementThread,
    ChannelType.PublicThread,
    ChannelType.PrivateThread,
    ChannelType.GuildStageVoice
] as const;

export default async function execute(ctx: CommandContext, channel: SendableChannels, options: MessageCreateOptions): Promise<void> {
    try {
        if (ctx.isSlashCommand()) {
            await ctx.deferReply();
        }
        await channel.send(options);
        await ctx.reply('Message sent.');
    } catch (error) {
        await ctx.replyOrFollowUp({ flags: MessageFlags.Ephemeral, content: (Error.isError(error) ? error.message : String(error)) + '.' })
    }
}

const slashCommand = new SlashCommand({
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
    async execute(ctx: SlashCommandContext): Promise<void> {
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

            await execute(ctx, channel, normalizeOptions({ content, files: attachments.map(attachment => attachment.url) }));
        }
    }
});
const messageCommand = new MessageCommand({
    aliases: ['send'],
    ownerOnly: true,
    async execute(ctx: MessageCommandContext): Promise<void> {
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

        await execute(ctx, channel, normalizeOptions({ content, files: attachments.map(attachment => attachment.url) }));
    }
});

export function registerSendCommand({ slashCommands, messageCommands }: CommandManagers): void {
    if (GUILD_ID != null) {
        slashCommands.register(slashCommand, { global: false, guildIds: [GUILD_ID] });
    }
    messageCommands?.register(messageCommand);
}
