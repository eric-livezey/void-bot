import { InteractionContextType, PermissionsBitField, SlashCommandBuilder, SlashCommandIntegerOption } from 'discord.js';
import { MessageCommand, SlashCommand } from '../command.js';
import type { CommandContext, MessageCommandContext, SlashCommandContext } from '../commandContext.js';
import type { CommandManagers } from '../commandManager.js';
import { canManagePlayback } from './play.js';

export default async function execute(ctx: CommandContext<true>, index: number): Promise<void> {
    if (await canManagePlayback(ctx)) {
        const { queue } = ctx.player;
        if (queue.length === 0) {
            await ctx.reply('The queue is empty.');
            return;
        }
        if (index < 1 || index > queue.length) {
            await ctx.reply(`${index} is not a valid index in the queue.`,);
            return;
        }
        const track = queue.remove(index - 1);
        await ctx.reply({ content: '**Removed**:', ...track.toMessage() });
    }
}

const DEFAULT_MEMBER_PERMISSIONS = new PermissionsBitField([
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak
]).freeze();

const slashCommand = new SlashCommand<true>({
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a track from the queue.')
        .addIntegerOption(new SlashCommandIntegerOption()
            .setName('index')
            .setDescription('The index of the track to remove.')
            .setMinValue(1)
            .setRequired(true))
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(DEFAULT_MEMBER_PERMISSIONS.bitfield),
    async execute(ctx: SlashCommandContext<true>): Promise<void> {
        const { options } = ctx.interaction;

        const index = options.getInteger('index', true);

        await execute(ctx, index);
    }
});
const messageCommand = new MessageCommand<true>({
    aliases: ['remove', 'rm'],
    memberPermissions: DEFAULT_MEMBER_PERMISSIONS,
    dmPermission: false,
    async execute(ctx: MessageCommandContext<true>): Promise<void> {
        const [indexInput] = ctx.getArguments(1);

        if (!indexInput) {
            await ctx.reply('`index` must be provided.');
            return;
        }

        if (!/^\d+$/.test(indexInput)) {
            await ctx.reply('`index` must be an integer.');
            return;
        }

        const index = parseInt(indexInput);

        if (index <= 0) {
            await ctx.reply('`index` must be greater than 0.');
            return;
        }

        await execute(ctx, index);
    }
});

export function registerRemoveCommand({ slashCommands, messageCommands }: CommandManagers): void {
    slashCommands.register(slashCommand);
    messageCommands?.register(messageCommand);
}
