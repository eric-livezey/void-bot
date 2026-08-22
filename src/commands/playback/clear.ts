import { InteractionContextType, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { MessageCommand, SlashCommand } from '../command.js';
import { CommandContext } from '../commandContext.js';
import type { CommandManagers } from '../commandManager.js';
import { canManagePlayback } from './play.js';

export default async function execute(ctx: CommandContext<true>) {
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

const DEFAULT_MEMBER_PERMISSIONS = new PermissionsBitField([
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak
]).freeze();

const slashCommand = new SlashCommand<true>({
    data: new SlashCommandBuilder()
        .setName('clear')
        .setDescription('Clear the queue.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(DEFAULT_MEMBER_PERMISSIONS.bitfield),
    execute,
});
const messageCommand = new MessageCommand<true>({
    aliases: ['clear'],
    memberPermissions: DEFAULT_MEMBER_PERMISSIONS,
    dmPermission: false,
    execute,
});

export function registerClearCommand({ slashCommands, messageCommands }: CommandManagers): void {
    slashCommands.register(slashCommand);
    messageCommands?.register(messageCommand);
}
