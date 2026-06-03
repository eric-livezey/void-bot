import { InteractionContextType, PermissionsBitField, SlashCommandBuilder, SlashCommandStringOption } from 'discord.js';
import { YTNodes } from 'youtubei.js';
import { Command } from '..';
import { CommandContext, InteractionContext, MessageContext } from '../../context';
import { getInnertubeInstance } from '../../innertube';
import { Track } from '../../player';
import { connectToSpeak, playTrack } from './play';

function getVideoIdFromSearchResult(result: YTNodes.MusicResponsiveListItem) {
    if (result.id != null) {
        return result.id;
    }
    return [
        result.endpoint,
        result.overlay?.content?.endpoint,
        ...result.menu?.contents
            .filterType(YTNodes.MenuNavigationItem)
            .flatMap(n => [n.endpoint, n.endpoint.command]) ?? []
    ].find(e => e?.is(YTNodes.WatchEndpoint))?.as(YTNodes.WatchEndpoint).buildRequest().videoId;
}

export async function playMusic(ctx: CommandContext<true>, query: string) {
    if (!await connectToSpeak(ctx)) {
        return;
    }

    const innertube = await getInnertubeInstance();
    const items = await innertube.music.search(query, { type: 'song' });
    if (!items.songs?.contents.length) {
        await ctx.reply('There were no valid results for your query.');
        return;
    }
    const videoId = getVideoIdFromSearchResult(items.songs.contents[0]);
    if (videoId == null) {
        await ctx.reply('Failed to extract video ID from search result.');
        return;
    }
    const track = await Track.fromVideoId(videoId);

    await playTrack(ctx, track);
}

const permissions = new PermissionsBitField([
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak,
]).freeze();

export default {
    interaction: {
        data: new SlashCommandBuilder()
            .setName('play-music')
            .setDescription('Play music from YouTube.')
            .addStringOption(new SlashCommandStringOption()
                .setName('query')
                .setDescription('A search query.')
                .setRequired(true))
            .setContexts(InteractionContextType.Guild)
            .setDefaultMemberPermissions(permissions.bitfield),
        async execute(ctx: InteractionContext<true>) {
            const query = ctx.interaction.options.getString('query', true);

            await playMusic(ctx, query);
        }
    },
    message: [
        {
            aliases: ['playmusic', 'playm', 'pm'],
            requiredPermissions: permissions,
            isDmRestricted: true,
            async execute(ctx: MessageContext<true>) {
                const [query] = ctx.getArguments(1);

                if (query == null) {
                    await ctx.reply('`query` must be provided.');
                    return;
                }

                await playMusic(ctx, query);
            }
        }
    ]
} satisfies Command<true>;
