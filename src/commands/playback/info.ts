import { InteractionContextType, MessageFlags, PermissionsBitField, SlashCommandBuilder, SlashCommandIntegerOption } from 'discord.js';
import { MessageCommand, SlashCommand } from '../command.js';
import { CommandContext, MessageCommandContext, SlashCommandContext } from '../commandContext.js';
import type { CommandManagers } from '../commandManager.js';
import nowPlaying from './nowplaying.js';
import { canViewPlayback } from './play.js';

export default async function execute(ctx: CommandContext<true>, index: number): Promise<void> {
    if (index === 0) {
        await nowPlaying(ctx);
    } else if (await canViewPlayback(ctx)) {
        const { player } = ctx;
        if (index <= player.queue.length) {
            const track = player.queue.get(index - 1);
            if (track) {
                await ctx.reply(track.toMessage());
            } else {
                await ctx.reply({ flags: MessageFlags.Ephemeral, content: '`index` must be less than or equal to the length of the queue.' });
            }
        } else {
            await ctx.reply({ flags: MessageFlags.Ephemeral, content: '`index` must be less than or equal to the length of the queue.' });
        }
    }
}

const DEFAULT_MEMBER_PERMISSIONS = new PermissionsBitField([
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak
]).freeze();

const slashCommand = new SlashCommand<true>({
    data: new SlashCommandBuilder()
        .setName('info')
        .setDescription('Display the track at the given index in the queue.')
        .addIntegerOption(new SlashCommandIntegerOption()
            .setName('index')
            .setDescription('An index of a track in the queue.')
            .setMinValue(0)
            .setRequired(true))
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(DEFAULT_MEMBER_PERMISSIONS.bitfield),
    async execute(ctx: SlashCommandContext<true>) {
        const index = ctx.interaction.options.getInteger('index', true);

        await execute(ctx, index);
    },
});
const messageCommand = new MessageCommand<true>({
    aliases: ['info', 'i'],
    memberPermissions: DEFAULT_MEMBER_PERMISSIONS,
    dmPermission: false,
    async execute(ctx: MessageCommandContext<true>) {
        const [input] = ctx.getArguments(1);

        if (!input) {
            await ctx.reply('`index` must be provided.');
            return;
        }

        if (!/^\d+$/.test(input)) {
            await ctx.reply('`index` must be an integer.');
            return;
        }

        const index = parseInt(input);

        if (index < 0) {
            await ctx.reply('`index` must be greater than or equal to 0.');
            return;
        }

        return await execute(ctx, index);
    },
});

export function registerInfoCommand({ slashCommands, messageCommands }: CommandManagers): void {
    slashCommands.register(slashCommand);
    messageCommands?.register(messageCommand);
}
