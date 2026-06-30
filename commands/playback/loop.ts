import { InteractionContextType, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { CommandContext } from '../../context.js';
import type { Command } from '../index.js';
import { canManagePlayback } from './play.js';

export async function loop(ctx: CommandContext<true>) {
    if (await canManagePlayback(ctx)) {
        const { player } = ctx;
        const loop = player.loop = !player.loop;
        if (loop) {
            await ctx.reply('Loop enabled.');
        } else {
            await ctx.reply('Loop disabled.');
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
            .setName('loop')
            .setDescription('Loop the currently playing track.')
            .setContexts(InteractionContextType.Guild)
            .setDefaultMemberPermissions(permissions.bitfield),
        execute: loop,
    },
    message: [
        {
            aliases: ['loop'],
            requiredPermissions: permissions,
            isDmRestricted: true,
            execute: loop,
        }
    ]
} satisfies Command<true>;
