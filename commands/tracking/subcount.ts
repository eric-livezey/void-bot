import { InteractionContextType, MessageFlags, PermissionsBitField, SlashCommandBuilder, SlashCommandStringOption } from 'discord.js';
import { CommandContext, MessageCommandContext, SlashCommandContext } from '../../context.js';
import { getYouTubeChannelId } from '../../utils.js';
import type { Command } from '../index.js';

export async function subscriberCount(ctx: CommandContext<true>, input: string) {
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
            await ctx.replyOrFollowUp({ flags: MessageFlags.Ephemeral, content: (error as Error).message + '.' });
        }
    } else {
        await ctx.reply({ flags: MessageFlags.Ephemeral, content: 'You must provide a valid YouTube channel URL.' });
    }
}

const permissions = new PermissionsBitField(PermissionsBitField.Flags.ManageChannels);

export default {
    interaction: {
        data: new SlashCommandBuilder()
            .setName('subscriber-count')
            .setDescription('Track the subscriber count for a YouTube channel.')
            .addStringOption(new SlashCommandStringOption()
                .setName('url')
                .setDescription('URL of the YouTube channel.')
                .setRequired(true)
                .setMaxLength(500))
            .setContexts(InteractionContextType.Guild)
            .setDefaultMemberPermissions(permissions.bitfield),
        async execute(ctx: SlashCommandContext<true>) {
            const options = ctx.interaction.options;

            const channel = options.getString('url', true);

            await subscriberCount(ctx, channel);
        }
    },
    message: [
        {
            aliases: ['subcount', 'subscribercount'],
            requiredPermissions: permissions,
            isDmRestricted: true,
            async execute(ctx: MessageCommandContext<true>) {
                const [channel] = ctx.getArguments(1);

                if (!channel) {
                    await ctx.reply('You must provide a channel URL.');
                    return;
                }

                await subscriberCount(ctx, channel);
            }
        }
    ]
} satisfies Command<true>;
