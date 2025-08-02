import { InteractionContextType, PermissionsBitField, SlashCommandBuilder } from "discord.js";
import { Command } from "..";
import { CommandContext } from "../../context";
import { canManagePlayback } from "./play";

export async function shuffle(ctx: CommandContext<true>) {
    if (await canManagePlayback(ctx)) {
        const player = ctx.player;
        if (player.queue.length) {
            player.queue.shuffle();
            await ctx.reply('Queue shuffled.');
        } else {
            await ctx.reply('The queue is empty.');
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
            .setName('shuffle')
            .setDescription('Shuffle the queue.')
            .setContexts(InteractionContextType.Guild)
            .setDefaultMemberPermissions(permissions.bitfield),
        execute: shuffle,
    },
    message: [
        {
            aliases: ['shuffle'],
            requiredPermissions: permissions,
            isDmRestricted: true,
            execute: shuffle,
        }
    ]
} as Command;
