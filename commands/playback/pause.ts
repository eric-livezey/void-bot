import { InteractionContextType, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { Command } from '..';
import { CommandContext } from '../../context';
import { canManagePlayback } from './play';

export async function pause(ctx: CommandContext<true>) {
    if (await canManagePlayback(ctx)) {
        const { player } = ctx;
        if (!player.isPaused()) {
            const result = player.pause();
            if (result) {
                await ctx.reply('Playback paused.');
            } else {
                await ctx.reply('Unable to pause.');
            }
        } else {
            await ctx.reply('Playback is already paused.');
        }
    }
}

const permissions = new PermissionsBitField([
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak,
]).freeze();

export default {
    interaction: {
        data: new SlashCommandBuilder()
            .setName('pause')
            .setDescription('Pause the currently playing track.')
            .setContexts(InteractionContextType.Guild)
            .setDefaultMemberPermissions(permissions.bitfield),
        execute: pause,
    },
    message: [
        {
            aliases: ['pause'],
            requiredPermissions: permissions,
            isDmRestricted: true,
            execute: pause,
        }
    ]
} as Command;
