import { InteractionContextType, MessageFlags, PermissionsBitField, SlashCommandBuilder, SlashCommandStringOption } from 'discord.js';
import { getYouTubeChannelId } from '../../utils.js';
import { MessageCommand, SlashCommand } from '../command.js';
import type { CommandContext, MessageCommandContext, SlashCommandContext } from '../commandContext.js';
import type { CommandManagers } from '../commandManager.js';

export default async function execute(ctx: CommandContext<true>, input: string): Promise<void> {
    const channelId = await getYouTubeChannelId(input);
    if (channelId) {
        const { trackers } = ctx;
        try {
            if (!trackers.hasChannelTracker(ctx.guildId, channelId)) {
                if (ctx.isSlashCommand()) {
                    await ctx.deferReply();
                }
                const tracker = await trackers.addChannelTracker(ctx.guildId, channelId);
                await ctx.reply(`Tracking subscriber count updates for \`${tracker.title!}\`.`);
            } else {
                await ctx.reply({ flags: MessageFlags.Ephemeral, content: 'That channel is already being tracked.' });
            }
        } catch (error) {
            await ctx.replyOrFollowUp({ flags: MessageFlags.Ephemeral, content: (Error.isError(error) ? error.message : String(error)) + '.' });
        }
    } else {
        await ctx.reply({ flags: MessageFlags.Ephemeral, content: 'You must provide a valid YouTube channel URL.' });
    }
}

const DEFAULT_MEMBER_PERMISSIONS = new PermissionsBitField(PermissionsBitField.Flags.ManageChannels);

const slashCommand = new SlashCommand<true>({
    data: new SlashCommandBuilder()
        .setName('subscriber-count')
        .setDescription('Track the subscriber count for a YouTube channel.')
        .addStringOption(new SlashCommandStringOption()
            .setName('url')
            .setDescription('URL of the YouTube channel.')
            .setRequired(true)
            .setMaxLength(500))
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(DEFAULT_MEMBER_PERMISSIONS.bitfield),
    async execute(ctx: SlashCommandContext<true>): Promise<void> {
        const options = ctx.interaction.options;

        const channel = options.getString('url', true);

        await execute(ctx, channel);
    }
});
const messageCommand = new MessageCommand<true>({
    aliases: ['subcount', 'subscribercount'],
    memberPermissions: DEFAULT_MEMBER_PERMISSIONS,
    dmPermission: false,
    async execute(ctx: MessageCommandContext<true>): Promise<void> {
        const [channel] = ctx.getArguments(1);

        if (!channel) {
            await ctx.reply('You must provide a channel URL.');
            return;
        }

        await execute(ctx, channel);
    }
});

export function registerSubscriberCountCommand({ slashCommands, messageCommands }: CommandManagers): void {
    slashCommands.register(slashCommand);
    messageCommands?.register(messageCommand);
}
