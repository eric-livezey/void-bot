import { channelMention, ChannelType, InteractionContextType, PermissionsBitField, SlashCommandBuilder, SlashCommandChannelOption, VoiceBasedChannel } from "discord.js";
import { Command } from "..";
import { CommandContext, InteractionContext, MessageContext } from "../../context";
import { createVoiceConnection, resolveChannelId } from "../../utils";

export async function join(ctx: CommandContext<true>, channel?: VoiceBasedChannel) {
    if (channel && !ctx.member.permissionsIn(channel).has(permissions)) {
        await ctx.reply(`You don't have sufficient permissions to connect to ${channelMention(channel.id)}.`);
        return;
    }
    const voiceChannel = channel ?? ctx.member.voice.channel;
    if (!voiceChannel) {
        await ctx.reply('You are not in a voice channel.');
        return;
    }
    if (ctx.isInteraction()) {
        await ctx.deferReply();
    }
    const me = await ctx.guild.members.fetchMe();
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

const permissions = new PermissionsBitField(PermissionsBitField.Flags.Connect);

export default {
    interaction: {
        data: new SlashCommandBuilder()
            .setName('join')
            .setDescription('Make the bot join a voice channel.')
            .addChannelOption(new SlashCommandChannelOption()
                .setName('channel')
                .setDescription('A voice channel.')
                .addChannelTypes(ChannelType.GuildVoice))
            .setContexts(InteractionContextType.Guild)
            .setDefaultMemberPermissions(permissions.bitfield),
        async execute(ctx: InteractionContext<true>) {
            const options = ctx.interaction.options;

            const channel = options.getChannel('channel', false, [ChannelType.GuildVoice]) ?? undefined;

            await join(ctx, channel);
        }
    },
    message: [
        {
            aliases: ['join', 'connect'],
            requiredPermissions: permissions,
            isDmRestricted: true,
            async execute(ctx: MessageContext<true>) {
                const [input] = ctx.getArguments(1);
                let channel;
                if (input) {
                    const channelId = resolveChannelId(input);
                    channel = channelId ? await ctx.guild.channels.fetch(channelId).catch(() => null) : null;
                    if (!channel || channel.type !== ChannelType.GuildVoice) {
                        await ctx.reply('Invalid voice channel.');
                        return;
                    }
                }

                await join(ctx, channel);
            }
        }
    ]
} as Command;
