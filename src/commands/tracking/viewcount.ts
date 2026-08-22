import { InteractionContextType, MessageFlags, PermissionsBitField, SlashCommandBuilder, SlashCommandStringOption } from 'discord.js';
import type { CommandContext, MessageCommandContext, SlashCommandContext } from '../commandContext.js';
import { resolveVideoId } from '../../utils.js';
import { MessageCommand, SlashCommand } from '../command.js';
import type { CommandManagers } from '../commandManager.js';

export default async function execute(ctx: CommandContext<true>, input: string): Promise<void> {
    const videoId = resolveVideoId(input);
    if (videoId) {
        const { trackers } = ctx;
        try {
            if (!trackers.hasVideoTracker(ctx.guildId, videoId)) {
                if (ctx.isSlashCommand()) {
                    await ctx.deferReply();
                }
                const tracker = await trackers.addVideoTracker(ctx.guildId, videoId);
                await ctx.reply(`Tracking view count updates for \`${tracker.title!}\`.`);
            } else {
                await ctx.reply({ flags: MessageFlags.Ephemeral, content: 'That video is already being tracked.' });
            }
        } catch (error) {
            await ctx.replyOrFollowUp({ flags: MessageFlags.Ephemeral, content: (Error.isError(error) ? error.message : String(error)) + '.' });
        }
    } else {
        await ctx.reply({ flags: MessageFlags.Ephemeral, content: 'You must provide a valid YouTube video URL.' });
    }
}

const permissions = new PermissionsBitField(PermissionsBitField.Flags.ManageChannels).freeze();

const slashCommand = new SlashCommand<true>({
    data: new SlashCommandBuilder()
        .setName('view-count')
        .setDescription('Track the view count for a YouTube video.')
        .addStringOption(new SlashCommandStringOption()
            .setName('url')
            .setDescription('URL of the YouTube video.')
            .setRequired(true)
            .setMaxLength(500))
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(permissions.bitfield),
    async execute(ctx: SlashCommandContext<true>): Promise<void> {
        const options = ctx.interaction.options;

        const input = options.getString('url', true);

        await execute(ctx, input);
    }
});
const messageCommand = new MessageCommand<true>({
    aliases: ['viewcount'],
    memberPermissions: permissions,
    dmPermission: false,
    async execute(ctx: MessageCommandContext<true>): Promise<void> {
        const [input] = ctx.getArguments(1);

        if (!input) {
            await ctx.reply('You must provide a video URL.');
            return;
        }

        await execute(ctx, input);
    }
});

export function registerViewCountCommand({ slashCommands, messageCommands }: CommandManagers): void {
    slashCommands.register(slashCommand);
    messageCommands?.register(messageCommand);
}
