import { InteractionContextType, MessageFlags, PermissionsBitField, SlashCommandBuilder, SlashCommandStringOption } from 'discord.js';
import { CommandContext, MessageCommandContext, SlashCommandContext } from '../../context.js';
import { resolveVideoId } from '../../utils.js';
import type { Command } from '../index.js';

export async function viewCount(ctx: CommandContext<true>, input: string) {
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
            await ctx.replyOrFollowUp({ flags: MessageFlags.Ephemeral, content: (error as Error).message + '.' });
        }
    } else {
        await ctx.reply({ flags: MessageFlags.Ephemeral, content: 'You must provide a valid YouTube video URL.' });
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
        async execute(ctx: SlashCommandContext<true>) {
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
            async execute(ctx: MessageCommandContext<true>) {
                const [input] = ctx.getArguments(1);

                if (!input) {
                    await ctx.reply('You must provide a video URL.');
                    return;
                }

                await viewCount(ctx, input);
            }
        }
    ]
} satisfies Command<true>;
