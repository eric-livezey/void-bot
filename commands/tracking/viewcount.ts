import { InteractionContextType, PermissionsBitField, SlashCommandBuilder, SlashCommandStringOption } from 'discord.js';
import { Command } from '..';
import { CommandContext, InteractionContext, MessageContext } from '../../context';
import { resolveVideoId } from '../../utils';

export async function viewCount(ctx: CommandContext<true>, input: string) {
    const videoId = resolveVideoId(input);
    if (videoId) {
        const { trackers } = ctx;
        try {
            if (!trackers.hasVideoTracker(ctx.guildId, videoId)) {
                if (ctx.isInteraction()) {
                    await ctx.deferReply();
                }
                const tracker = await trackers.addVideoTracker(ctx.guildId, videoId);
                await ctx.reply(`Tracking view count updates for \`${tracker.title!}\`.`);
            } else {
                await ctx.reply('That video is already being tracked.', true);
            }
        } catch (error) {
            await ctx.replyOrFollowUp((error as Error).message + '.', true);
        }
    } else {
        await ctx.reply('You must provide a valid YouTube video URL.', true);
    }
}

const permissions = new PermissionsBitField(PermissionsBitField.Flags.ManageChannels).freeze();

export default {
    interaction: {
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
        async execute(ctx: InteractionContext<true>) {
            const options = ctx.interaction.options;

            const input = options.getString('url', true);

            await viewCount(ctx, input);
        }
    },
    message: [
        {
            aliases: ['viewcount'],
            requiredPermissions: permissions,
            isDmRestricted: true,
            async execute(ctx: MessageContext<true>) {
                const [input] = ctx.getArguments(1);

                if (!input) {
                    await ctx.reply('You must provide a video URL.');
                    return;
                }

                await viewCount(ctx, input);
            }
        }
    ]
} as Command;
