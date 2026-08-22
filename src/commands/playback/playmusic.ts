import { InteractionContextType, PermissionsBitField, SlashCommandBuilder, SlashCommandStringOption } from 'discord.js';
import { Utils, YTNodes } from 'youtubei.js';
import { getInnertubeInstance } from '../../innertube.js';
import { Track } from '../../player.js';
import { MessageCommand, SlashCommand } from '../command.js';
import { CommandContext, MessageCommandContext, SlashCommandContext } from '../commandContext.js';
import type { CommandManagers } from '../commandManager.js';
import { connectToSpeak, playTrack } from './play.js';

function getVideoIdFromSearchResult(result: YTNodes.MusicResponsiveListItem): string | undefined {
    return result.id ?? [
        result.endpoint,
        result.overlay?.content?.endpoint,
        ...result.menu?.contents
            .filterType(YTNodes.MenuNavigationItem)
            .flatMap(n => [n.endpoint, n.endpoint.command]) ?? []
    ].find(e => e?.is(YTNodes.WatchEndpoint) ?? false)?.as(YTNodes.WatchEndpoint).buildRequest().videoId;
}

export default async function execute(ctx: CommandContext<true>, query: string): Promise<void> {
    if (!await connectToSpeak(ctx)) {
        return;
    }

    const innertube = await getInnertubeInstance();
    const items = await innertube.music.search(query, { type: 'song' });
    if (!items.songs?.contents.length) {
        await ctx.reply('There were no valid results for your query.');
        return;
    }
    const song = items.songs.contents[0];
    let videoId;
    if (!song || (videoId = getVideoIdFromSearchResult(song)) == null) {
        await ctx.reply('Failed to extract video ID from search result.');
        return;
    }
    let track;
    try {
        track = await Track.fromVideoId(videoId);
    } catch (error) {
        if (error instanceof Utils.InnertubeError) {
            await ctx.reply('The video URL is invalid.');
        } else if (Error.isError(error)) {
            await ctx.reply(error.message);
        } else {
            console.error(error);
            await ctx.reply('An unexpected error ocurred.');
        }
        return;
    }
    await playTrack(ctx, track);
}

const DEFAULT_MEMBER_PERMISSIONS = new PermissionsBitField([
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak
]).freeze();

const slashCommand = new SlashCommand<true>({
    data: new SlashCommandBuilder()
        .setName('play-music')
        .setDescription('Play music from YouTube.')
        .addStringOption(new SlashCommandStringOption()
            .setName('query')
            .setDescription('A search query.')
            .setRequired(true))
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(DEFAULT_MEMBER_PERMISSIONS.bitfield),
    async execute(ctx: SlashCommandContext<true>): Promise<void> {
        const query = ctx.interaction.options.getString('query', true);

        await execute(ctx, query);
    }
});
const messageCommand = new MessageCommand<true>({
    aliases: ['playmusic', 'playm', 'pm'],
    memberPermissions: DEFAULT_MEMBER_PERMISSIONS,
    dmPermission: false,
    async execute(ctx: MessageCommandContext<true>): Promise<void> {
        const [query] = ctx.getArguments(1);

        if (query == null) {
            await ctx.reply('`query` must be provided.');
            return;
        }

        await execute(ctx, query);
    }
});

export function registerPlayMusicCommand({ slashCommands, messageCommands }: CommandManagers): void {
    slashCommands.register(slashCommand);
    messageCommands?.register(messageCommand);
}
