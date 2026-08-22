import { channelMention, ChannelType, InteractionContextType, PermissionsBitField, SlashCommandBuilder, SlashCommandChannelOption, type VoiceBasedChannel } from 'discord.js';
import { createVoiceConnection, resolveChannelId } from '../../utils.js';
import { MessageCommand, SlashCommand } from '../command.js';
import { CommandContext, MessageCommandContext, SlashCommandContext } from '../commandContext.js';
import type { CommandManagers } from '../commandManager.js';

export default async function execute(ctx: CommandContext<true>, channel?: VoiceBasedChannel) {
    if (!ctx.isOwner() && channel && !ctx.member.permissionsIn(channel).has(DEFAULT_MEMBER_PERMISSIONS)) {
        await ctx.reply(`You don't have sufficient permissions to connect to ${channelMention(channel.id)}.`);
        return;
    }
    const voiceChannel = channel ?? ctx.member.voice.channel;
    if (!voiceChannel) {
        await ctx.reply('You are not in a voice channel.');
        return;
    }
    if (ctx.isSlashCommand()) {
        await ctx.deferReply();
    }
    const me = await voiceChannel.guild.members.fetchMe();
    if (me.voice.channelId !== voiceChannel.id) {
        if (voiceChannel.joinable) {
            createVoiceConnection(voiceChannel);
            await ctx.reply(`Connected to ${channelMention(voiceChannel.id)}.`);
        } else {
            await ctx.reply(`I don't have sufficient permissions to connect to ${channelMention(voiceChannel.id)}.`);
        }
    } else {
        await ctx.reply(`I am already connected to ${channelMention(voiceChannel.id)}.`);
    }
}

const DEFAULT_MEMBER_PERMISSIONS = new PermissionsBitField(PermissionsBitField.Flags.Connect);

const slashCommand = new SlashCommand<true>({
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Make the bot join a voice channel.')
        .addChannelOption(new SlashCommandChannelOption()
            .setName('channel')
            .setDescription('A voice channel.')
            .addChannelTypes(ChannelType.GuildVoice))
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(DEFAULT_MEMBER_PERMISSIONS.bitfield),
    async execute(ctx: SlashCommandContext<true>) {
        const options = ctx.interaction.options;

        await execute(ctx, options.getChannel('channel', false, [ChannelType.GuildVoice]) ?? undefined);
    }
});
const messageCommand = new MessageCommand<true>({
    aliases: ['join', 'connect'],
    memberPermissions: DEFAULT_MEMBER_PERMISSIONS,
    dmPermission: false,
    async execute(ctx: MessageCommandContext<true>) {
        const [input] = ctx.getArguments(1);
        let channel;
        if (input) {
            const channelId = resolveChannelId(input);
            channel = channelId ? await (ctx.isOwner() ? ctx.client.channels : ctx.guild.channels).fetch(channelId).catch(() => null) : null;
            if (!channel || channel.type !== ChannelType.GuildVoice) {
                await ctx.reply('Invalid voice channel.');
                return;
            }
        }

        await execute(ctx, channel);
    }
});

export function registerJoinCommand({ slashCommands, messageCommands }: CommandManagers): void {
    slashCommands.register(slashCommand);
    messageCommands?.register(messageCommand);
}
