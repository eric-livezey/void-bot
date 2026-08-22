import { InteractionContextType, PermissionsBitField, SlashCommandBuilder, SlashCommandStringOption } from 'discord.js';
import { getInnertubeInstance } from '../../innertube.js';
import { MessageCommand, SlashCommand } from '../command.js';
import { CommandContext, MessageCommandContext, SlashCommandContext } from '../commandContext.js';
import type { CommandManagers } from '../commandManager.js';
import { connectToSpeak, playPlaylist } from './play.js';

export default async function execute(ctx: CommandContext<true>, query: string): Promise<void> {
    if (!await connectToSpeak(ctx)) {
        return;
    }

    const innertube = await getInnertubeInstance();
    const items = await innertube.music.search(query, { type: 'album' });
    const contents = items.albums?.contents;
    const albumId = contents?.[0]?.id;
    if (albumId) {
        const album = await innertube.music.getAlbum(albumId);
        const albumUrl = new URL(album.url!);
        const playlistId = albumUrl.searchParams.get('list')!;
        const playlist = await innertube.getPlaylist(playlistId);
        await playPlaylist(ctx, playlist);
    } else {
        await ctx.reply('There were no valid results for your query.');
    }
}

const DEFAULT_MEMBER_PERMISSIONS = new PermissionsBitField([
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak
]).freeze();

const slashCommand = new SlashCommand<true>({
    data: new SlashCommandBuilder()
        .setName('play-album')
        .setDescription('Play an album from YouTube.')
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
    aliases: ['playalbum', 'playa', 'pa'],
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

export function registerPlayAlbumCommand({ slashCommands, messageCommands }: CommandManagers): void {
    slashCommands.register(slashCommand);
    messageCommands?.register(messageCommand);
}
