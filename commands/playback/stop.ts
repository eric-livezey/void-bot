import { InteractionContextType, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { Command } from '..';
import { CommandContext } from '../../context';
import { canManagePlayback } from './play';

export async function stop(ctx: CommandContext<true>) {
    if (await canManagePlayback(ctx)) {
        ctx.player.stop();
        await ctx.reply({ content: 'Playback stopped.' });
    }
}

const permissions = new PermissionsBitField([
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak
]).freeze();

export default {
    interaction: {
        data: new SlashCommandBuilder()
            .setName('stop')
            .setDescription('Stop the player.')
            .setContexts(InteractionContextType.Guild)
            .setDefaultMemberPermissions(permissions.bitfield),
        execute: stop,
    },
    message: [
        {
            aliases: ['stop'],
            requiredPermissions: permissions,
            isDmRestricted: true,
            execute: stop,
        }
    ]
} as Command;
