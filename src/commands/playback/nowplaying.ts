import { InteractionContextType, PermissionsBitField, SlashCommandBuilder } from 'discord.js';
import { MessageCommand, SlashCommand } from '../command.js';
import type { CommandContext } from '../commandContext.js';
import type { CommandManagers } from '../commandManager.js';
import { canViewPlayback } from './play.js';

export default async function execute(ctx: CommandContext<true>): Promise<void> {
    if (await canViewPlayback(ctx)) {
        const track = ctx.player.nowPlaying;
        if (track) {
            await ctx.reply({ content: '**Now Playing**:', ...track.toMessage() });
        } else {
            await ctx.reply('Nothing is playing.');
        }
    }
}

const DEFAULT_MEMBER_PERMISSIONS = new PermissionsBitField([
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak
]).freeze();

const slashCommand = new SlashCommand<true>({
    data: new SlashCommandBuilder()
        .setName('now-playing')
        .setDescription('Display the currently playing track.')
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(DEFAULT_MEMBER_PERMISSIONS.bitfield),
    execute,
});
const messageCommand = new MessageCommand<true>({
    aliases: ['nowplaying', 'np'],
    memberPermissions: DEFAULT_MEMBER_PERMISSIONS,
    dmPermission: false,
    execute,
});

export function registerNowPlayingCommand({ slashCommands, messageCommands }: CommandManagers): void {
    slashCommands.register(slashCommand);
    messageCommands?.register(messageCommand);
}
