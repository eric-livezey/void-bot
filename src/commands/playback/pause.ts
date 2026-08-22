import { InteractionContextType, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { MessageCommand, SlashCommand } from '../command.js';
import { CommandContext } from '../commandContext.js';
import type { CommandManagers } from '../commandManager.js';
import { canManagePlayback } from './play.js';

export default async function execute(ctx: CommandContext<true>): Promise<void> {
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

const DEFAULT_MEMBER_PERMISSIONS = new PermissionsBitField([
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak
]).freeze();

const slashCommand = new SlashCommand<true>({
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause the currently playing track.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(DEFAULT_MEMBER_PERMISSIONS.bitfield),
    execute,
});
const messageCommand = new MessageCommand<true>({
    aliases: ['pause'],
    memberPermissions: DEFAULT_MEMBER_PERMISSIONS,
    dmPermission: false,
    execute,
});

export function registerPauseCommand({ slashCommands, messageCommands }: CommandManagers): void {
    slashCommands.register(slashCommand);
    messageCommands?.register(messageCommand);
}
