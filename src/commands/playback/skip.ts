import { InteractionContextType, PermissionsBitField, SlashCommandBuilder, SlashCommandIntegerOption } from 'discord.js';
import { MessageCommand, SlashCommand } from '../command.js';
import type { CommandContext, MessageCommandContext, SlashCommandContext } from '../commandContext.js';
import type { CommandManagers } from '../commandManager.js';
import { canManagePlayback } from './play.js';

export default async function execute(ctx: CommandContext<true>, count?: number): Promise<void> {
    if (await canManagePlayback(ctx)) {
        const { player } = ctx;
        if (count == null) {
            const track = await player.skip();
            if (track) {
                await ctx.reply({ content: '**Skipped**:', ...track.toMessage() });
            } else {
                await ctx.reply('Nothing is playing.');
            }
        } else {
            const { length } = player.queue.splice(0, count - 1);
            const track = await player.skip();
            if (track) {
                await ctx.reply(`Skipped ${length + 1} tracks.`);
            } else {
                await ctx.reply('Nothing is playing.');
            }
        }
    }
}

const DEFAULT_MEMBER_PERMISSIONS = new PermissionsBitField([
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak
]).freeze();

const slashCommand = new SlashCommand<true>({
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the current track.')
        .addIntegerOption(new SlashCommandIntegerOption()
            .setName('count')
            .setDescription('The number of tracks to skip.')
            .setMinValue(1))
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(DEFAULT_MEMBER_PERMISSIONS.bitfield),
    async execute(ctx: SlashCommandContext<true>): Promise<void> {
        const options = ctx.interaction.options;

        const count = options.getInteger('count') ?? undefined;

        await execute(ctx, count);
    },
});
const messageCommand = new MessageCommand<true>({
    aliases: ['skip'],
    memberPermissions: DEFAULT_MEMBER_PERMISSIONS,
    dmPermission: false,
    async execute(ctx: MessageCommandContext<true>): Promise<void> {
        const [input] = ctx.getArguments(1);

        let count;
        if (input) {
            if (!/^\d+$/.test(input)) {
                await ctx.reply('`count` must be an integer.');
                return;
            }
            count = parseInt(input);
            if (count <= 0) {
                await ctx.reply('`count` must be greater than 0.');
                return;
            }
        }

        await execute(ctx, count);
    },
});

export function registerSkipCommand({ slashCommands, messageCommands }: CommandManagers): void {
    slashCommands.register(slashCommand);
    messageCommands?.register(messageCommand);
}
