import { Attachment, channelMention, EmbedBuilder, InteractionContextType, PermissionsBitField, SlashCommandBuilder, SlashCommandStringOption } from 'discord.js';
import { YTNodes } from 'youtubei.js';
import { Playlist } from 'youtubei.js/dist/src/parser/youtube';
import { Command } from '..';
import { ownerId } from '../../config.json';
import { CommandContext, InteractionContext, MessageContext } from '../../context';
import { getInnertubeInstance } from '../../innertube';
import { Track } from '../../player';
import { bestThumbnail, channelURL, createVoiceConnection, extractPlaylistId, extractVideoId, playlistURL, resolveURL } from '../../utils';
import { resume } from './resume';

export async function canManagePlayback(ctx: CommandContext<true>) {
    const { player } = ctx;
    if (player.isPlaying()) {
        if (ctx.isInteraction()) {
            await ctx.deferReply();
        }
        const me = await ctx.guild.members.fetchMe();
        const channel = me.voice.channel;
        if (channel) {
            if (ctx.member.voice.channelId === channel.id) {
                if (ctx.member.permissionsIn(channel).has(PermissionsBitField.Flags.Speak)) {
                    return true;
                } else {
                    await ctx.reply(`You don't have permission to speak in ${channelMention(channel.id)}.`);
                }
            } else {
                await ctx.reply('You must be in the same voice channel as the bot to use this command.');
            }
        } else {
            await ctx.reply('Nothing is playing.');
        }
    } else {
        await ctx.reply('Nothing is playing.', true);
    }
    return false;
}

export async function canViewPlayback(ctx: CommandContext<true>) {
    const { player } = ctx;
    if (player.isPlaying()) {
        return true;
    } else {
        await ctx.reply('Nothing is playing', true);
    }
    return false;
}

export async function connectToSpeak(ctx: CommandContext<true>) {
    const channel = ctx.member.voice.channel;
    if (!channel) {
        await ctx.reply('You are not in a voice channel.', true);
        return false;
    }
    if (!ctx.member.permissionsIn(channel).has(PermissionsBitField.Flags.Speak)) {
        await ctx.reply(`You don't have permission to speak in ${channelMention(channel.id)}.`, true);
        return false;
    }
    if (ctx.isInteraction()) {
        await ctx.deferReply();
    }
    const me = await ctx.guild.members.fetchMe();
    if (!me.permissionsIn(channel).has(PermissionsBitField.Flags.Speak)) {
        await ctx.reply(`I don't have sufficient permissions to speak in ${channelMention(channel.id)}.`);
        return false;
    } else if (me.voice.channelId !== channel.id) {
        if (channel.joinable) {
            createVoiceConnection(channel);
            return true;
        } else {
            await ctx.reply(`I don't have suffucient permissions to connect to ${channelMention(channel.id)}.`);
            return false;
        }
    } else {
        return true;
    }
}

export async function playPlaylist(ctx: CommandContext<true>, playlist: Playlist) {
    const { player } = ctx;
    let totalAdded = 0;
    do {
        for (const video of playlist.videos) {
            if (video.is(YTNodes.PlaylistVideo) && video.is_playable) {
                const track = Track.fromPlaylistItem(video);
                const index = await player.enqueue(track);
                // NOTE: Failed tracks are skipped if prepared during enqueue
                if (index === 0) {
                    await ctx.reply({ content: '**Now Playing**:', embeds: [track.toEmbed()] });
                } else if (index > 0) {
                    totalAdded++;
                }
            }
        }
    } while (playlist.has_continuation && (playlist = await playlist.getContinuation()));

    const { info } = playlist;
    const eb = new EmbedBuilder()
        .setTitle(info.title ?? 'Unknown')
        .setURL(playlistURL(playlist.endpoint!.payload.playlistId))
        .setThumbnail(bestThumbnail(info.thumbnails).url);
    const { author } = info;
    if (author) eb.setAuthor({ name: author.name, url: channelURL(author.id) });
    await ctx.replyOrFollowUp({
        content: '**Added ' + totalAdded + ' tracks to the queue**:',
        embeds: [eb.toJSON()]
    });
}

export async function playTrack(ctx: CommandContext<true>, track: Track) {
    const { player } = ctx;
    const position = await player.enqueue(track);
    if (position < 0) {
        await ctx.reply(`An error occurred while attempting to play the video.`);
    } else if (position === 0) {
        await ctx.reply({ content: '**Now Playing**:', embeds: [track.toEmbed()] });
    } else {
        await ctx.reply({
            content: '**Added to the Queue**:',
            embeds: [track.toEmbed({ name: 'Position', value: position.toLocaleString(), inline: true })],
        });
    }
}

export async function play(ctx: CommandContext<true>, { input, attachment }: { input?: string, attachment?: Attachment }) {
    if (await connectToSpeak(ctx)) {
        if (attachment) {
            const track = Track.fromURL(attachment.url);
            await playTrack(ctx, track);
        } else if (input) {
            const innertube = await getInnertubeInstance();
            const url = resolveURL(input!);
            if (url) {
                // URL
                const videoId = extractVideoId(url);
                if (videoId != null) {
                    // video URL
                    const track = await Track.fromVideoId(videoId).catch(() => null);
                    if (track) {
                        await playTrack(ctx, track);
                    } else {
                        await ctx.reply('The video URL is invalid.');
                    }
                    return;
                }
                const playlistId = extractPlaylistId(url);
                if (playlistId != null) {
                    // playlist URL
                    const playlist = await innertube.getPlaylist(playlistId).catch(() => null);
                    if (playlist) {
                        await playPlaylist(ctx, playlist);
                    } else {
                        await ctx.reply('The playlist URL is invalid.');
                    }
                    return;
                }
                if (ctx.user.id === ownerId) {
                    const track = Track.fromURL(input);
                    await playTrack(ctx, track);
                    return;
                }
                await ctx.reply('The URL is invalid.');
            } else {
                // search query
                const search = await innertube.search(input, { type: 'video' });
                const video = search.results.firstOfType(YTNodes.Video);
                if (video) {
                    await playTrack(ctx, Track.fromSearchResult(video));
                } else {
                    await ctx.reply('There were no valid results for your query.');
                }
            }
        } else {
            await ctx.reply('You must provice a link or search query.');
        }
    }
}

const permissions = new PermissionsBitField([
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak
]).freeze();

export default {
    interaction: {
        data: new SlashCommandBuilder()
            .setName('play')
            .setDescription('Play something from YouTube.')
            .addStringOption(new SlashCommandStringOption()
                .setName('query')
                .setDescription('A YouTube link or search query.')
                .setRequired(true))
            .setContexts(InteractionContextType.Guild)
            .setDefaultMemberPermissions(permissions.bitfield),
        async execute(ctx: InteractionContext<true>) {
            const options = ctx.interaction.options;

            const input = options.getString('query', true);

            await play(ctx, { input });
        }
    },
    message: [
        {
            aliases: ['play'],
            requiredPermissions: permissions,
            isDmRestricted: true,
            async execute(ctx: MessageContext<true>) {
                const [input] = ctx.getArguments(1);
                const attachment = ctx.message.attachments.first();

                if (!input && !attachment) {
                    await resume(ctx);
                    return;
                }

                await play(ctx, { input, attachment });
            }
        }
    ]
} as Command;
