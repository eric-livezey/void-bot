import { InteractionContextType, MessageFlags, PermissionsBitField, SlashCommandBuilder, SlashCommandIntegerOption } from 'discord.js';
import { MessageCommand, SlashCommand } from '../command.js';
import { CommandContext, MessageCommandContext, SlashCommandContext } from '../commandContext.js';
import type { CommandManagers } from '../commandManager.js';
import { canManagePlayback } from './play.js';

export default async function execute(ctx: CommandContext<true>, source: number, destination: number): Promise<void> {
    if (await canManagePlayback(ctx)) {
        const { queue } = ctx.player;
        if (queue.length === 0) {
            await ctx.reply('The queue is empty.');
            return;
        }
        if (source < 1 || source > queue.length) {
            await ctx.reply(`${source} is not a valid index in the queue.`);
            return;
        }
        if (destination < 1 || destination > queue.length) {
            await ctx.reply(`${destination} is not a valid index in the queue.`);
            return;
        }
        if (source === destination) {
            await ctx.reply('Indices must not be equal.');
            return;
        }
        const track = queue.get(source - 1);
        queue.move(source - 1, destination - 1);
        await ctx.reply({
            content: `Moved **${track.url ? `[${track.title}](${track.url})` : track.title}** to index ${destination} in the queue.`,
            flags: [MessageFlags.SuppressEmbeds]
        });
    }
}

const DEFAULT_MEMBER_PERMISSIONS = new PermissionsBitField([
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak
]).freeze();

const slashCommand = new SlashCommand<true>({
    data: new SlashCommandBuilder()
        .setName('move')
        .setDescription('Move a track in the queue.')
        .addIntegerOption(new SlashCommandIntegerOption()
            .setName('source')
            .setDescription('The index of the track to move.')
            .setMinValue(1)
            .setRequired(true))
        .addIntegerOption(new SlashCommandIntegerOption()
            .setName('destination')
            .setDescription('The index to move the track to.')
            .setMinValue(1)
            .setRequired(true))
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(DEFAULT_MEMBER_PERMISSIONS.bitfield),
    async execute(ctx: SlashCommandContext<true>): Promise<void> {
        const { options } = ctx.interaction;

        const source = options.getInteger('source', true);
        const destination = options.getInteger('destination', true);

        await execute(ctx, source, destination);
    }
});
const messageCommand = new MessageCommand<true>({
    aliases: ['move', 'mv'],
    memberPermissions: DEFAULT_MEMBER_PERMISSIONS,
    dmPermission: false,
    async execute(ctx: MessageCommandContext<true>): Promise<void> {
        const [sourceInput, destinationInput] = ctx.getArguments(2);

        if (!sourceInput || !destinationInput) {
            await ctx.reply('Both `source` and `destination` must be provided.');
            return;
        }

        if (!/^\d+$/.test(sourceInput) || !/^\d+$/.test(destinationInput)) {
            await ctx.reply('Both `source` and `destination` must be integers.');
            return;
        }

        const source = parseInt(sourceInput);
        const destination = parseInt(destinationInput);

        if (source <= 0 || destination <= 0) {
            await ctx.reply('Both `source` and `destination` must be greater than 0.');
            return;
        }

        await execute(ctx, source, destination);
    }
});

export function registerMoveCommand({ slashCommands, messageCommands }: CommandManagers): void {
    slashCommands.register(slashCommand);
    messageCommands?.register(messageCommand);
}
