import { InteractionContextType, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { Command } from '..';
import { CommandContext } from '../../context';
import { canManagePlayback } from './play';

export async function clear(ctx: CommandContext<true>) {
    if (await canManagePlayback(ctx)) {
        const { player } = ctx;
        if (player.queue.length) {
            player.queue.clear();
            await ctx.reply('Queue cleared.');
        } else {
            await ctx.reply('The queue is empty.');
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
            .setName('clear')
            .setDescription('Clear the queue.')
            .setContexts(InteractionContextType.Guild)
            .setDefaultMemberPermissions(permissions.bitfield),
        execute: clear,
    },
    message: [
        {
            aliases: ['clear'],
            requiredPermissions: permissions,
            isDmRestricted: true,
            execute: clear,
        }
    ]
} as Command;
