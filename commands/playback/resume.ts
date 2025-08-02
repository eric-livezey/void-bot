import { InteractionContextType, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { Command } from "..";
import { CommandContext } from "../../context";
import { canManagePlayback } from "./play";

export async function resume(ctx: CommandContext<true>) {
    if (await canManagePlayback(ctx)) {
        const player = ctx.player;
        if (player.isPaused()) {
            const result = player.unpause();
            if (result) {
                await ctx.reply('Playback resumed.');
            } else {
                await ctx.reply('Unable to resume.');
            }
        } else {
            await ctx.reply('Playback is not paused.');
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
            .setName('resume')
            .setDescription('Resume the currently playing track.')
            .setContexts(InteractionContextType.Guild)
            .setDefaultMemberPermissions(permissions.bitfield),
        execute: resume,
    },
    message: [
        {
            aliases: ['resume', 'unpause'],
            requiredPermissions: permissions,
            isDmRestricted: true,
            execute: resume,
        }
    ]
} as Command;
