import { InteractionContextType, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { MessageCommand, SlashCommand } from '../command.js';
import { CommandContext } from '../commandContext.js';
import type { CommandManagers } from '../commandManager.js';
import { canManagePlayback } from './play.js';

export default async function execute(ctx: CommandContext<true>): Promise<void> {
    if (await canManagePlayback(ctx)) {
        const { player } = ctx;
        if (player.queue.length) {
            player.queue.shuffle();
            await ctx.reply('Queue shuffled.');
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
        .setName('shuffle')
        .setDescription('Shuffle the queue.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(DEFAULT_MEMBER_PERMISSIONS.bitfield),
    execute,
});
const messageCommand = new MessageCommand<true>({
    aliases: ['shuffle'],
    memberPermissions: DEFAULT_MEMBER_PERMISSIONS,
    dmPermission: false,
    execute,
});

export function registerShuffleCommand({ slashCommands, messageCommands }: CommandManagers): void {
    slashCommands.register(slashCommand);
    messageCommands?.register(messageCommand);
}
