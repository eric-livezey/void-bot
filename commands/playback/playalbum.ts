import { InteractionContextType, PermissionsBitField, SlashCommandBuilder, SlashCommandStringOption } from 'discord.js';
import { Command } from '..';
import { CommandContext, InteractionContext, MessageContext } from '../../context';
import { getInnertubeInstance } from '../../innertube';
import { connectToSpeak, playPlaylist } from './play';

export async function playAlbum(ctx: CommandContext<true>, query: string) {
    if (!await connectToSpeak(ctx)) {
        return;
    }

    const innertube = await getInnertubeInstance();
    const items = await innertube.music.search(query, { type: 'album' });
    const contents = items.albums?.contents;
    if (contents?.length) {
        const album = await innertube.music.getAlbum(contents[0].id!);
        const albumUrl = new URL(album.url!);
        const playlistId = albumUrl.searchParams.get('list')!;
        const playlist = await innertube.getPlaylist(playlistId);
        await playPlaylist(ctx, playlist);
    } else {
        await ctx.reply('There were no valid results for your query.');
    }
}

const permissions = new PermissionsBitField([
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak,
]).freeze();

export default {
    interaction: {
        data: new SlashCommandBuilder()
            .setName('play-album')
            .setDescription('Play an album from YouTube.')
            .addStringOption(new SlashCommandStringOption()
                .setName('query')
                .setDescription('A search query.')
                .setRequired(true))
            .setContexts(InteractionContextType.Guild)
            .setDefaultMemberPermissions(permissions.bitfield),
        async execute(ctx: InteractionContext<true>) {
            const query = ctx.interaction.options.getString('query', true);

            await playAlbum(ctx, query);
        }
    },
    message: [
        {
            aliases: ['playalbum', 'playa', 'pa'],
            requiredPermissions: permissions,
            isDmRestricted: true,
            async execute(ctx: MessageContext<true>) {
                const [query] = ctx.getArguments(1);

                if (query == null) {
                    await ctx.reply('`query` must be provided.');
                    return;
                }

                await playAlbum(ctx, query);
            }
        }
    ]
} as Command;
