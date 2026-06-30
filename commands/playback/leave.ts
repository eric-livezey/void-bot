import { getVoiceConnection } from '@discordjs/voice';
import { channelMention, InteractionContextType, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { CommandContext } from '../../context.js';
import type { Command } from '../index.js';

export async function leave(ctx: CommandContext<true>) {
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

const permissions = new PermissionsBitField(PermissionsBitField.Flags.Connect).freeze();

export default {
    interaction: {
        data: new SlashCommandBuilder()
            .setName('leave')
            .setDescription('Make the bot leave a voice channel.')
            .setContexts(InteractionContextType.Guild)
            .setDefaultMemberPermissions(permissions.bitfield),
        execute: leave,
    },
    message: [
        {
            aliases: ['leave', 'disconnect', 'fuckoff', 'kys'],
            requiredPermissions: permissions,
            isDmRestricted: true,
            execute: leave,
        }
    ]
} satisfies Command<true>;
