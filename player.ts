import { AudioPlayer, AudioPlayerStatus, AudioResource, createAudioPlayer, createAudioResource, getVoiceConnection, PlayerSubscription, VoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';
import { APIEmbedField, EmbedBuilder, RestOrArray, Snowflake } from 'discord.js';
import { exec, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import { MusicResponsiveListItem, PlaylistVideo, Video } from 'youtubei.js/dist/src/parser/nodes';
import { VideoInfo } from 'youtubei.js/dist/src/parser/youtube';
import { getInnertubeInstance } from './innertube';
import { channelURL, Duration, generateVideoThumbnail, videoURL } from './utils';
import ffmpegPath from 'ffmpeg-static';

const AUDIO_CACHE_DIR = path.join('cache', 'audio');
const SHOULD_DOWNLOAD = true;

// const DefaultFormatOptions = {
//     quality: 'highestaudio',
// } as const satisfies chooseFormatOptions;

export interface TrackAuthor {
    /**
     * Author name.
     */
    readonly name: string | null;
    /**
     * URL to author.
     */
    readonly url: string | null;
    /**
     * URL to author icon.
     */
    readonly iconURL: string | null;
}

export interface TrackOptions {
    url?: string;
    thumbnail?: string;
    duration?: number;
    author?: {
        -readonly [P in keyof TrackAuthor]?: Exclude<TrackAuthor[P], null>;
    }
}

/**
 * Represents a track to played by a player.
 */
export class Track<T = unknown> {
    /**
     * The title of the track.
     */
    public readonly title: string;
    /**
     * The URL to the track.
     */
    public readonly url: string | null;
    /**
     * The URL to the thumbnail image.
     */
    public readonly thumbnail: string | null;
    /**
     * The track's duration in milliseconds.
     */
    public readonly duration: number | null;
    /**
     * The track's author's info.
     */
    public readonly author: TrackAuthor;
    private audioResource: Promise<AudioResource<T> | null> | AudioResource<T> | null;
    private error: Error | null;
    private readonly preparefn: () => Promise<AudioResource<T>> | AudioResource<T>;
    /**
     * Returns the current state of the {@link AudioResource} object associated with the track.
     */
    public get resource() {
        return this.audioResource;
    }
    /**
     * @param preparefn A function which resolves an {@link AudioResource} to be used.
     * @param title The title of the track.
     * @param details Track details.
     */
    public constructor(preparefn: () => Promise<AudioResource<T>>, title: string, details?: TrackOptions) {
        this.audioResource = null;
        this.error = null;
        this.preparefn = preparefn;
        this.title = title;
        if (details == null) {
            details = {};
        }
        this.url = details.url ?? null;
        this.thumbnail = details.thumbnail ?? null;
        this.duration = details.duration ?? null;
        this.author = {
            name: details.author?.name ?? null,
            url: details.author?.url ?? null,
            iconURL: details.author?.iconURL ?? null
        };
    }
    /**
     * Create a track from a URL. A track created this way will never be downloaded.
     *
     * @param url A url to an audio file.
     * @param title The title of the track.
     * @param details Track details.
     */
    public static fromURL(url: URL | string, title?: string, details?: TrackOptions) {
        url = new URL(url);
        const prepare = async () => {
            const res = await fetch(url);
            if (!res.body) {
                throw new Error(`Request to ${url} did not return a response body.`);
            }
            if (!res.ok) {
                throw new Error(`Request to ${url} responded with ${res.status} ${res.statusText}`)
            }
            const stream = Readable.fromWeb(res.body as ReadableStream);
            return createAudioResource(stream, { inlineVolume: true })
        };
        if (title == null)
            title = url.pathname.substring(url.pathname.lastIndexOf('/') + 1) || 'Unknown Title';
        if (details == null)
            details = {};
        if (details.url == null)
            details.url = url.toString();
        return new Track(prepare, title, details);
    }
    /**
     * Creates a track from an innertube video info object.
     *
     * @param info An innertube video info object.
     */
    public static fromVideoInfo(info: VideoInfo) {
        // const { videoDetails, videoDetails: { videoId } } = info;
        // const prepare = createYtdlVideoInfoPrepare(info);
        const { basic_info: videoDetails } = info;
        const videoId = videoDetails.id!;
        const prepare = createYtDlpPrepare(videoId);
        const details = {
            url: videoURL(videoId, true),
            thumbnail: generateVideoThumbnail(videoId).url,
            duration: info.basic_info.duration! * 1000,
            author: {
                name: videoDetails.author!,
                url: channelURL(videoDetails.channel!.id!),
            }
        };
        return new Track(prepare, videoDetails.title!, details);
    }
    /**
     * Creates a track from a YouTube video ID.
     *
     * @param videoId A YouTube video ID.
     */
    public static async fromVideoId(videoId: string) {
        const innertube = await getInnertubeInstance();
        // const info = await (SHOULD_DOWNLOAD && existsSync(path.join(AUDIO_CACHE_DIR, `${videoId}.webm`)) ? ytdl.getBasicInfo(videoId) : ytdl.getInfo(videoId));
        const info = await innertube.getBasicInfo(videoId);
        info.basic_info.id ??= videoId;
        return Track.fromVideoInfo(info);
    }
    /**
     * Creates a track fomr a YouTube video search result.
     * 
     * @param result A YouTube video search result.
     */
    public static fromSearchResult(result: Video) {
        const videoId = result.video_id;
        const prepare = createYtDlpPrepare(videoId);
        const details = {
            url: videoURL(videoId, true),
            thumbnail: generateVideoThumbnail(videoId).url,
            duration: result.duration.seconds * 1000,
            author: {
                name: result.author.name,
                url: result.author.url,
            },
        };
        return new Track(prepare, result.title.toString(), details);
    }
    /**
     * Creates a track from a playlist item.
     *
     * @param item A playlist item.
     */
    public static fromPlaylistItem(item: PlaylistVideo) {
        const videoId = item.id;
        const prepare = createYtDlpPrepare(videoId);
        const details = {
            url: videoURL(videoId, true),
            thumbnail: generateVideoThumbnail(videoId).url,
            duration: item.duration.seconds * 1000,
            author: {
                name: item.author.name,
                url: item.author.url,
            },
        };
        return new Track(prepare, item.title.toString(), details);
    }
    /**
     * Creates a track from an album item.
     * 
     * **NOTE**: This may have have different metadata than it's YouTube video equivalent.
     *
     * @param item An album item.
     */
    public static fromAlbumItem(item: MusicResponsiveListItem) {
        const videoId = item.id!;
        const prepare = createYtDlpPrepare(videoId);
        const details = {
            url: videoURL(videoId, true),
            thumbnail: generateVideoThumbnail(videoId).url,
            duration: item.duration!.seconds * 1000,
            author: {
                name: item.artists![0].name,
                url: item.artists![0].endpoint?.toURL(),
            },
        };
        return new Track(prepare, item.title!.toString(), details);
    }
    /**
     * Returns whether the track has been resolved successfully.
     */
    public isResolved(): this is this & { resource: AudioResource<T>; } {
        return this.resource instanceof AudioResource;
    }
    /**
     * Returns whether the track has been prepared.
     */
    public isPrepared(): this is this & { resource: Promise<AudioResource<T> | null> | AudioResource<T> } {
        return this.audioResource != null;
    }
    /**
     * Reset the track which allows the audio resource to be created again.
     */
    public reset() {
        this.audioResource = null;
        this.error = null;
    }
    /**
     * Prepare the audio resource. If the resource is already being prepared, nothing will happen.
     */
    public prepare() {
        if (!this.isPrepared()) {
            this.audioResource = new Promise<AudioResource<T>>(resolve => { resolve(this.preparefn()) }).catch(error => { this.error = error; return null; });
        }
    }
    /**
     * Resolve the audio resource.
     */
    public async resolve() {
        if (this.isResolved()) {
            return this.resource as Promise<AudioResource<T>>;
        }
        this.prepare();
        this.audioResource = await this.resource;
        if (this.error != null || !this.isResolved()) {
            throw this.error ?? new Error('the resource could not resolved to an AudioResource');
        }
        return this.resource as Promise<AudioResource<T>>;
    }
    /**
     * Returns a APIEmbed representation of the track.
     *
     * @param fields Additional embed fields.
     */
    public toEmbed(...fields: RestOrArray<APIEmbedField>) {
        new Date().getSeconds();
        const eb = new EmbedBuilder();
        eb.setTitle(this.title);
        if (this.url != null) {
            eb.setURL(this.url);
        }
        if (this.author.name != null) {
            eb.setAuthor({ name: this.author.name, url: this.author.url ?? undefined, iconURL: this.author.iconURL ?? undefined });
        }
        if (this.thumbnail != null) {
            eb.setThumbnail(this.thumbnail);
        }
        if (this.duration != null || this.isResolved() && this.resource.started) {
            let duration = this.duration != null ? Duration.format(this.duration) : 'unknown';
            if (this.isResolved() && this.resource.started) {
                duration = `${Duration.format(this.resource.playbackDuration)}/${duration}`;
            }
            eb.addFields({ name: 'Duration', value: duration, inline: true });
        }
        if (fields.length > 0)
            eb.addFields(...fields);
        return eb.toJSON();
    }
}

/**
 * Represents a queue of tracks. Ensures that the first track is the queue is always prepared.
 */
export class Queue implements Iterable<Track> {
    private readonly list: Track[];
    public constructor() {
        this.list = [];
    }
    public get length() {
        return this.list.length;
    }
    public get duration() {
        return this.list.reduce((acc, track) => acc + (track.duration ?? 0), 0);
    }
    public [Symbol.iterator]() {
        return this.values();
    }
    public values() {
        return this.list.values();
    }
    public push(value: Track) {
        const length = this.list.push(value);
        if (this.list.length === 1) {
            value.prepare();
        }
        return length;
    }
    public shift() {
        const value = this.list.shift();
        if (this.list.length > 0) {
            this.list[0].prepare();
        }
        return value as Track | undefined;
    }
    public get(index: number) {
        if (index < 0 || index >= this.list.length) {
            throw new RangeError(`index ${index} is out of bounds`);
        }
        return this.list[index];
    }
    public set(index: number, value: Track) {
        if (index < 0 || index >= this.list.length) {
            throw new RangeError(`index ${index} is out of bounds`);
        }
        this.list[index] = value;
        if (index === 0) {
            value.prepare();
        }
    }
    public remove(index: number) {
        if (index < 0 || index >= this.list.length) {
            throw new RangeError(`index ${index} is out of bounds`);
        }
        const value = this.list.splice(index, 1)[0];
        if (index === 0 && this.list.length > 0) {
            this.list[0].prepare();
        }
        return value;
    }
    public move(source: number, destination: number) {
        if (source < 0 || source >= this.list.length) {
            throw new RangeError(`index ${source} is out of bounds`);
        }
        if (destination < 0 || destination >= this.list.length) {
            throw new RangeError(`index ${destination} is out of bounds`);
        }
        const value = this.list.splice(source, 1)[0];
        this.list.splice(destination, 0, value);
        if (source === 0 || destination === 0) {
            this.list[0].prepare();
        }
    }
    public splice(start: number, deleteCount?: number) {
        // explicitly passing undefined for deleteCount in Array.splice is converted to 0
        const part = this.list.splice(start, deleteCount ?? Infinity);
        if ((deleteCount == null || deleteCount > 0) && this.length > 0) {
            this.list[0].prepare();
        }
        return part;
    }
    public clear() {
        this.splice(0);
    }
    public shuffle() {
        let currentIndex = this.list.length, randomIndex = -1;
        while (currentIndex > 0) {
            randomIndex = Math.floor(Math.random() * currentIndex);
            currentIndex--;
            [this.list[currentIndex], this.list[randomIndex]] = [this.list[randomIndex], this.list[currentIndex]];
        }
        if (this.list.length > 0) {
            this.list[0].prepare();
        }
    }
}

/**
 * Represents a player for a guild.
 */
export class Player extends EventEmitter<{ error: [Error]; }> {
    /**
     * The id of the guild the player is associated with.
     */
    public readonly guildId: Snowflake;
    /**
     * The player's {@link Queue} of tracks.
     */
    public readonly queue: Queue;
    /**
     * Whether the player should loop the current track.
     */
    public loop: boolean;
    private static readonly cache = new Map<Snowflake, Player>();
    private nowPlayingTrack: Track | null;
    private volume: number;
    private subscription: PlayerSubscription | null;
    private connection: VoiceConnection | null;
    private audioPlayer: AudioPlayer;
    /**
     * The currently playing track.
     */
    public get nowPlaying() {
        return this.nowPlayingTrack;
    }

    private constructor(guildId: string) {
        super();
        this.guildId = guildId;
        this.queue = new Queue();
        this.loop = false;
        this.nowPlayingTrack = null;
        this.volume = 1;
        this.connection = null;
        this.subscription = null;
        const audioPlayer = createAudioPlayer();
        audioPlayer.on(AudioPlayerStatus.Idle, async oldState => {
            if (oldState.status !== AudioPlayerStatus.Idle)
                await this.next().catch(error => { this.emit('error', error); });
        });
        audioPlayer.on('error', async error => {
            this.emit('error', error);
            await this.skip();
        });
        this.audioPlayer = audioPlayer;
    }

    /**
     * Returns the player associated with `guildId` or creates a new one if one does not yet exist.
     *
     * @param guildId A guild ID.
     */
    public static of(guildId: Snowflake) {
        if (!this.cache.has(guildId)) {
            const player = new Player(guildId);
            player.on('error', error => {
                console.error(error);
            });
            this.cache.set(guildId, player);
        }
        return this.cache.get(guildId)!;
    }
    /**
     * Returns whether the player is ready to play audio.
     */
    public isReady() {
        const connection = this.getConnection();
        return connection != null && connection.state.status !== VoiceConnectionStatus.Destroyed && connection.state.status !== VoiceConnectionStatus.Disconnected;
    }
    /**
     * Returns whether the player is currently playing a track.
     */
    public isPlaying(): this is this & { nowPlaying: Track } {
        return this.nowPlaying != null;
    }
    /**
     * Returns whether the player is paused.
     */
    public isPaused() {
        return this.audioPlayer.state.status === AudioPlayerStatus.Paused;
    }
    /**
     * Returns the volume of the player.
     */
    public getVolume() {
        return this.volume;
    }
    /**
     * Set the volume of the player.
     *
     * @param value A percentage.
     */
    public setVolume(value: number) {
        if (value < 0) {
            throw new RangeError('volume must be a positive number');
        }
        this.volume = value;
        if (this.isPlaying() && this.nowPlaying.isResolved() && this.nowPlaying.resource.volume != null) {
            this.nowPlaying.resource.volume.setVolume(value);
        }
    }
    /**
     * Returns the {@link VoiceConnection} the player is subscribed to.
     */
    public getConnection(): VoiceConnection | null {
        if (this.connection == null || this.connection.state.status === VoiceConnectionStatus.Destroyed) {
            this.setConnection(getVoiceConnection(this.guildId) ?? null);
        }
        return this.connection;
    }
    /**
     * Set the {@link VoiceConnection} the player should be subscribed to.
     * 
     * @param value 
     */
    public setConnection(value: VoiceConnection | null) {
        if (this.subscription != null) {
            this.subscription.unsubscribe();
        }
        if (value == null || value.state?.status === VoiceConnectionStatus.Destroyed || value.state?.status === VoiceConnectionStatus.Disconnected) {
            this.stop();
        } else if (value instanceof VoiceConnection) {
            this.setConnection(null);
            this.subscription = value.subscribe(this.audioPlayer) as PlayerSubscription;
            value.on('stateChange', (_oldState, newState) => {
                if (newState.status === VoiceConnectionStatus.Destroyed || newState.status === VoiceConnectionStatus.Disconnected) {
                    this.stop();
                }
            });
            value.on('error', error => {
                this.stop();
                this.emit('error', error);
            });
        } else {
            throw new TypeError('connection must be an instance of VoiceConnection or null');
        }
        this.connection = value;
    }
    /**
     * Plays a track or pushes it to the queue.
     *
     * @param track A track.
     */
    public async enqueue(track: Track) {
        if (!this.isPlaying()) {
            return await this.play(track).then(() => 0).catch(() => -1);
        }
        return this.queue.push(track);
    }
    /**
     * Pauses the player.
     */
    public pause() {
        if (this.isPlaying() && !this.isPaused()) {
            if (this.audioPlayer.pause()) {
                return true;
            } else {
                throw new Error('failed to pause the track');
            }
        }
        return false;
    }
    /**
     * Unpauses the player.
     */
    public unpause() {
        if (this.isPlaying() && this.isPaused()) {
            if (this.audioPlayer.unpause()) {
                return true;
            } else {
                throw new Error('failed to unpause the track');
            }
        }
        return false;
    }
    /**
     * Stops the player and clears the queue.
     */
    public stop() {
        this.queue.clear();
        this.loop = false;
        this.nowPlayingTrack = null;
        this.audioPlayer.stop(true);
    }
    /**
     * Skips the current track.
     */
    public async skip() {
        this.loop = false;
        const track = this.nowPlaying;
        await this.next();
        return track;
    }
    /**
     * Destroys the player.
     */
    public destroy() {
        this.stop();
        Player.cache.delete(this.guildId);
    }
    public getEmbed(page: number) {
        const totalPages = Math.max(Math.ceil(this.queue.length / 25) - 1, 0);
        if (page < 0 || totalPages > 0 && page > totalPages || !Number.isSafeInteger(page)) {
            throw new RangeError(`page ${page} is invalid`);
        }
        if (!this.isPlaying()) {
            return null;
        }
        if (this.queue.length === 0) {
            return this.nowPlaying.toEmbed();
        }
        const eb = new EmbedBuilder();
        if (page === 0) {
            const { title, url, description } = this.nowPlaying.toEmbed();
            eb.setAuthor({ name: 'Now Playing:' });
            if (title != null) {
                eb.setTitle(title);
            }
            if (url != null) {
                eb.setURL(url);
            }
            if (description != null) {
                eb.setDescription(description);
            }
        }
        for (let i = page * 25; i < this.queue.length && i < (page + 1) * 25; i++) {
            const track = this.queue.get(i);
            eb.addFields({
                name: ' ',
                value: `**${i + 1}: ${track.url ? `[${track.title}](${track.url})` : track.title}**\n${track.duration != null ? Duration.format(track.duration) : ''}`
            });
        }
        const duration = (this.nowPlaying.duration ?? 0) + this.queue.duration;
        eb.setFooter({ text: `${this.queue.length + 1} items (${Duration.format(duration)})${this.queue.length > 25 ? `\nPage ${page + 1}/${totalPages + 1}` : ''}` });
        return eb.toJSON();
    }

    private async next() {
        if (this.audioPlayer.state.status !== AudioPlayerStatus.Idle) {
            this.audioPlayer.stop(true);
            return;
        }
        if (this.loop && this.isPlaying()) {
            this.nowPlaying.reset();
            await this.play(this.nowPlaying).catch(() => { this.skip() });
        }
        else {
            const track = this.queue.shift();
            if (track) {
                await this.play(track).catch(() => { this.skip() });
            }
            else {
                this.stop();
            }
        }
    }
    private async play(track: Track) {
        if (!this.isReady()) {
            this.stop();
            throw new Error('the audio connection was invalidated');
        }
        this.nowPlayingTrack = track;
        let resource = null;
        try {
            resource = await track.resolve();
        }
        catch (e) {
            this.nowPlayingTrack = null;
            console.error(e);
            throw e;
        }
        if (resource.volume) {
            resource.volume.setVolume(this.getVolume());
        }
        this.audioPlayer.play(resource);
        if (this.isPaused()) {
            this.unpause();
        }
    }
}

// keep track of in progress downloads
const downloads: Record<string, Promise<string>> = {};

// function downloadFromStream(stream: Readable, path: string, id: string) {
//     if (id in downloads) {
//         // return in progress downloads
//         return downloads[id];
//     } else {
//         return downloads[id] = new Promise((resolve, reject) => {
//             const start = Date.now();
//             const writeStream = createWriteStream(path);
//             // cleanly reject errors and remove the file
//             function error(...args: Parameters<typeof reject>) {
//                 try {
//                     writeStream.close();
//                     rmSync(path);
//                 } catch (e) {
//                     delete downloads[id];
//                     reject(e);
//                 }
//                 delete downloads[id];
//                 reject(...args);
//             }
//             // timeout
//             const timeout = setTimeout(() => {
//                 if (writeStream.bytesWritten === 0)
//                     error(`error on download ${id}: timed out after 10 seconds`);
//             }, 10000);
//             writeStream.once('finish', () => {
//                 const end = Date.now();
//                 console.log(`Took ${end - start}ms to download ${id}.webm.`);
//                 clearTimeout(timeout);
//                 if (writeStream.bytesWritten === 0)
//                     error(`error on download ${id}: the write stream didn't write any data`);
//                 delete downloads[id];
//                 resolve(path);
//             });
//             writeStream.once('error', (e) => {
//                 clearTimeout(timeout);
//                 error(e);
//             });
//             stream.pipe(writeStream);
//         });
//     }
// }

const DefaultCreateAudioResourceOptions = {
    inlineVolume: true
};

function createDownloadPrepare(id: string, fn: (path: string) => Promise<string>) {
    if (!existsSync(AUDIO_CACHE_DIR)) {
        mkdirSync(AUDIO_CACHE_DIR, { recursive: true });
    }
    const file = path.join(AUDIO_CACHE_DIR, `${id}.webm`);
    return async function prepare() {
        if (existsSync(file)) {
            return createAudioResource(file, DefaultCreateAudioResourceOptions);
        } else {
            return fn(file).then(path => createAudioResource(path, DefaultCreateAudioResourceOptions));
        }
    }
}

function createStreamPrepare(id: string, fn: () => Promise<Readable>) {
    const file = path.join(AUDIO_CACHE_DIR, `${id}.webm`);
    return async function prepare() {
        if (existsSync(file)) {
            // use prior downloaded tracks even in streams as they are more reliable
            return createAudioResource(file, DefaultCreateAudioResourceOptions);
        } else {
            return await fn().then(stream => createAudioResource(stream, DefaultCreateAudioResourceOptions));
        }
    }
}

// ytdl-core (no longer supported)

// function createReadablePrepare(id: string, fn: () => Readable, download = SHOULD_DOWNLOAD) {
//     if (download) {
//         return createDownloadPrepare(id, (path) => downloadFromStream(fn(), path, id));
//     } else {
//         return createStreamPrepare(async () => fn());
//     }
// }

// function createYtdlPrepare(videoId: string, download = SHOULD_DOWNLOAD) {
//     return createReadablePrepare(videoId, () => ytdl(videoId, DefaultFormatOptions), download);
// }

// function createYtdlVideoInfoPrepare(info: videoInfo, download = SHOULD_DOWNLOAD) {
//     return createReadablePrepare(info.videoDetails.videoId, () => ytdl.downloadFromInfo(info, DefaultFormatOptions), download);
// }

// yt-dlp
// NOTE: ytdl-core is significantly faster

function createYtDlpPrepare(videoId: string, download = SHOULD_DOWNLOAD) {
    if (download) {
        return createDownloadPrepare(videoId, (path: string) => downloadAudio(videoId, path));
    } else {
        return createStreamPrepare(videoId, () => getStreamingURL(videoId).then(url => fetch(url)).then(res => Readable.fromWeb(res.body! as ReadableStream)));
    }
}

function downloadAudio(videoId: string, path: string) {
    // return current download or create new promise to resolve downloaded audio
    return downloads[videoId] ??= new Promise<string>((resolve, reject) => {
        // arguments
        const args = [
            '-f', 'bestaudio',
            '-o', path,
            '--quiet',
            videoId.startsWith('-') ? videoURL(videoId) : videoId
        ];

        // spawn yt-dlp
        const proc = spawn('yt-dlp', args);

        // log error messages
        proc.stderr.on('data', data => {
            process.stderr.write(data);
        });

        proc.once('error', (err) => {
            reject(err);
        })

        // resolve or reject on closes
        proc.once('close', code => {
            delete downloads[videoId];
            if (code === 0) {
                if (existsSync(path)) {
                    resolve(path);
                } else {
                    reject('yt-dlp exited without downloading anything');
                }
            } else {
                rmSync(path);
                reject(`yt-dlp exited with code ${code}.`);
            }
        });
    });
}

function getStreamingURL(videoId: string) {
    // resolve the streaming URL from yt-dlp
    return new Promise<string>((resolve, reject) => {
        exec(`yt-dlp -f bestaudio --get-url ${videoId}`, (error, stdout) => {
            if (error) {
                reject(error);
            } else {
                resolve(stdout.trim())
            }
        });
    });
}
