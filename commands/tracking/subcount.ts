import { InteractionContextType, PermissionsBitField, SlashCommandBuilder, SlashCommandStringOption } from 'discord.js';
import { Command } from '..';
import { CommandContext, InteractionContext, MessageContext } from '../../context';
import { getYouTubeChannelId } from '../../utils';

export async function subscriberCount(ctx: CommandContext<true>, input: string) {
    const channelId = await getYouTubeChannelId(input);
    if (channelId) {
        const { trackers } = ctx;
        try {
            if (!trackers.hasChannelTracker(ctx.guildId, channelId)) {
                if (ctx.isInteraction()) {
                    await ctx.deferReply();
                }
                const tracker = await trackers.addChannelTracker(ctx.guildId, channelId);
                await ctx.reply(`Tracking subscriber count updates for \`${tracker.title!}\`.`);
            } else {
                await ctx.reply('That channel is already being tracked.', true);
            }
        } catch (error) {
            await ctx.replyOrFollowUp((error as Error).message + '.', true);
        }
    } else {
        await ctx.reply('You must provide a valid YouTube channel URL.', true);
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
        async execute(ctx: InteractionContext<true>) {
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
            async execute(ctx: MessageContext<true>) {
                const [channel] = ctx.getArguments(1);

                if (!channel) {
                    await ctx.reply('You must provide a channel URL.');
                    return;
                }

                await subscriberCount(ctx, channel);
            }
        }
    ]
} as Command;
