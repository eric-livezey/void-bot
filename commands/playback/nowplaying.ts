import { InteractionContextType, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { Command } from '..';
import { CommandContext } from '../../context';
import { canViewPlayback } from './play';

export async function nowPlaying(ctx: CommandContext<true>) {
    if (await canViewPlayback(ctx)) {
        const track = ctx.player.nowPlaying;
        if (track) {
            await ctx.reply({ content: '**Now Playing**:', embeds: [track.toEmbed()] });
        } else {
            await ctx.reply('Nothing is playing.');
        }
    }
}

const permissions = new PermissionsBitField([
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak
]).freeze();

export default {
    interaction: {
        data: new SlashCommandBuilder()
            .setName('now-playing')
            .setDescription('Display the currently playing track.')
            .setContexts(InteractionContextType.Guild)
            .setDefaultMemberPermissions(permissions.bitfield),
        execute: nowPlaying,
    },
    message: [
        {
            aliases: ['nowplaying', 'np'],
            requiredPermissions: permissions,
            isDmRestricted: true,
            execute: nowPlaying,
        }
    ]
} as Command;
