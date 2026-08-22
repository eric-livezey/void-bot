import { InteractionContextType, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { MessageCommand, SlashCommand } from '../command.js';
import { CommandContext } from '../commandContext.js';
import type { CommandManagers } from '../commandManager.js';
import { canManagePlayback } from './play.js';

export default async function execute(ctx: CommandContext<true>): Promise<void> {
    if (await canManagePlayback(ctx)) {
        ctx.player.stop();
        await ctx.reply({ content: 'Playback stopped.' });
    }
}

const DEFAULT_MEMBER_PERMISSIONS = new PermissionsBitField([
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak
]).freeze();

const slashCommand = new SlashCommand<true>({
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop the player.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(DEFAULT_MEMBER_PERMISSIONS.bitfield),
    execute,
});
const messageCommand = new MessageCommand<true>({
    aliases: ['stop'],
    memberPermissions: DEFAULT_MEMBER_PERMISSIONS,
    dmPermission: false,
    execute,
});

export function registerStopCommand({ slashCommands, messageCommands }: CommandManagers): void {
    slashCommands.register(slashCommand);
    messageCommands?.register(messageCommand);
}
