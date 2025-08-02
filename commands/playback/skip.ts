import { InteractionContextType, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { Command } from "..";
import { CommandContext } from "../../context";
import { canManagePlayback } from "./play";

export async function skip(ctx: CommandContext<true>) {
    if (await canManagePlayback(ctx)) {
        const track = await ctx.player.skip();
        if (track) {
            await ctx.reply({ content: '**Skipped**', embeds: [track.toEmbed()] });
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
            .setName('skip')
            .setDescription('Skip the current track.')
            .setContexts(InteractionContextType.Guild)
            .setDefaultMemberPermissions(permissions.bitfield),
        execute: skip,
    },
    message: [
        {
            aliases: ['skip'],
            requiredPermissions: permissions,
            isDmRestricted: true,
            execute: skip,
        }
    ]
} as Command;
