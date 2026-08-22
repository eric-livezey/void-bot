import { getVoiceConnection } from '@discordjs/voice';
import { channelMention, InteractionContextType, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { MessageCommand, SlashCommand } from '../command.js';
import { CommandContext } from '../commandContext.js';
import type { CommandManagers } from '../commandManager.js';

export default async function execute(ctx: CommandContext<true>): Promise<void> {
    if (ctx.isSlashCommand()) {
        await ctx.deferReply();
    }
    const me = await ctx.guild.members.fetchMe();
    const channel = me.voice.channel;
    if (channel) {
        if (ctx.isOwner() || ctx.member.voice.channelId === channel.id || ctx.member.permissionsIn(channel).has(PermissionsBitField.Flags.Connect)) {
            getVoiceConnection(ctx.guildId)?.destroy();
            await ctx.reply(`Disconnected from ${channelMention(channel.id)}.`);
        } else {
            await ctx.reply(`You don't have sufficient permissions to connect to ${channelMention(channel.id)}`);
        }
    } else {
        await ctx.reply(`I am not in a voice channel.`);
    }
}

const DEFAULT_MEMBER_PERMISSIONS = new PermissionsBitField(PermissionsBitField.Flags.Connect).freeze();

const slashCommand = new SlashCommand<true>({
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Make the bot leave a voice channel.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(DEFAULT_MEMBER_PERMISSIONS.bitfield),
    execute,
});
const messageCommand = new MessageCommand<true>({
    aliases: ['leave', 'disconnect', 'fuckoff', 'kys'],
    memberPermissions: DEFAULT_MEMBER_PERMISSIONS,
    dmPermission: false,
    execute,
});

export function registerLeaveCommand({ slashCommands, messageCommands }: CommandManagers): void {
    slashCommands.register(slashCommand);
    messageCommands?.register(messageCommand);
}
