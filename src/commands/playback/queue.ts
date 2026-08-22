import { InteractionContextType, type MessagePayloadOption, SlashCommandBuilder } from 'discord.js';
import { Player } from '../../player.js';
import { MessageCommand, SlashCommand } from '../command.js';
import type { CommandContext } from '../commandContext.js';
import type { CommandManagers } from '../commandManager.js';
import { canViewPlayback } from './play.js';

export function generateQueueMessage(player: Player, page: number): MessagePayloadOption {
    const n = Math.max(Math.ceil(player.queue.length / 20) - 1, 0);
    if ((page + 1) * 20 > player.queue.length) {
        page = n;
    }
    if (page < 0) {
        page = 0;
    }
    return player.generateQueueMessage(page);
}

export default async function execute(ctx: CommandContext<true>): Promise<void> {
    if (await canViewPlayback(ctx)) {
        const { player } = ctx;
        await ctx.reply(generateQueueMessage(player, 0));
    }
}

const slashCommand = new SlashCommand<true>({
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('Display the queue.')
        .setContexts(InteractionContextType.Guild),
    execute,
});
const messageCommand = new MessageCommand<true>({
    aliases: ['queue', 'q'],
    dmPermission: false,
    execute,
});

export function registerQueueCommand({ slashCommands, messageCommands }: CommandManagers): void {
    slashCommands.register(slashCommand);
    messageCommands?.register(messageCommand);
}
