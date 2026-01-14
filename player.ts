import { AudioPlayer, AudioPlayerStatus, AudioResource, createAudioPlayer, createAudioResource, CreateAudioResourceOptions, getVoiceConnection, PlayerSubscription, VoiceConnection, VoiceConnectionStatus } from '@discordjs/voice';
import { APIEmbed, APIEmbedField, EmbedBuilder, RestOrArray, Snowflake } from 'discord.js';
import { exec, spawn } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { existsSync, mkdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { ReadableStream } from 'node:stream/web';
import { MusicResponsiveListItem, PlaylistVideo, Video } from 'youtubei.js/dist/src/parser/nodes';
import { VideoInfo } from 'youtubei.js/dist/src/parser/youtube';
import { getInnertubeInstance } from './innertube';
import { channelURL, Duration, generateVideoThumbnailUrl, videoURL } from './utils';

const AUDIO_CACHE_DIR = path.join('cache', 'audio');
const SHOULD_DOWNLOAD = true;
const MAX_RETRIES = 5;

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

export type PrepareFunction<M = null> = () => Promise<AudioResource<M>>;

/**
 * Represents a track to played by a player.
 */
export class Track<M = null> {
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
    private audioResource: Promise<AudioResource<M> | null> | AudioResource<M> | null;
    private error: Error | null;
    private readonly preparefn: PrepareFunction<M>;
    /**
     * Returns the current state of the {@link AudioResource} object associated with the track.
     */
    public get resource(): Promise<AudioResource<M> | null> | AudioResource<M> | null {
        return this.audioResource;
    }
    /**
     * @param preparefn A function which resolves an {@link AudioResource} to be used.
     * @param title The title of the track.
     * @param details Track details.
     */
    public constructor(preparefn: PrepareFunction<M>, title: string, details?: TrackOptions) {
        this.audioResource = null;
        this.error = null;
        this.preparefn = preparefn;
        this.title = title;
        details ??= {};
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
    public static fromURL(url: URL | string, title?: string, details?: TrackOptions): Track {
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
        title ??= url.pathname.substring(url.pathname.lastIndexOf('/') + 1) || 'Unknown Title';
        details ??= {};
        details.url ??= url.toString();
        return new Track(prepare, title, details);
    }
    /**
     * Creates a track from a YouTube video ID.
     *
     * @param videoId A YouTube video ID.
     */
    public static async fromVideoId(videoId: string): Promise<Track> {
        const innertube = await getInnertubeInstance();
        const info = await innertube.getBasicInfo(videoId);
        info.basic_info.id ??= videoId;
        return Track.fromVideoInfo(info);
    }
    /**
     * Creates a track from an innertube video info object.
     *
     * @param info An innertube video info object.
     */
    public static fromVideoInfo(info: VideoInfo): Track {
        const { basic_info: videoDetails } = info;
        const videoId = videoDetails.id!;
        const prepare = createYtDlpPrepare(videoId);
        const details = {
            url: videoURL(videoId, true),
            thumbnail: generateVideoThumbnailUrl(videoId),
            duration: info.basic_info.duration! * 1000,
            author: {
                name: videoDetails.author!,
                url: channelURL(videoDetails.channel!.id!),
            }
        } satisfies TrackOptions;
        return new Track(prepare, videoDetails.title!, details);
    }
    /**
     * Creates a track from a YouTube video search result.
     * 
     * @param result A YouTube video search result.
     */
    public static fromSearchResult(result: Video): Track {
        const videoId = result.video_id;
        const prepare = createYtDlpPrepare(videoId);
        const details = {
            url: videoURL(videoId, true),
            thumbnail: generateVideoThumbnailUrl(videoId),
            duration: result.duration.seconds * 1000,
            author: {
                name: result.author.name,
                url: result.author.url,
            },
        } satisfies TrackOptions;
        return new Track(prepare, result.title.toString(), details);
    }
    /**
     * Creates a track from a playlist item.
     *
     * @param item A playlist item.
     */
    public static fromPlaylistItem(item: PlaylistVideo): Track {
        const videoId = item.id;
        const prepare = createYtDlpPrepare(videoId);
        const details = {
            url: videoURL(videoId, true),
            thumbnail: generateVideoThumbnailUrl(videoId),
            duration: item.duration.seconds * 1000,
            author: {
                name: item.author.name,
                url: item.author.url,
            },
        } satisfies TrackOptions;
        return new Track(prepare, item.title.toString(), details);
    }
    /**
     * Creates a track from an album item.
     * 
     * **NOTE**: This may have have different metadata than it's YouTube video equivalent.
     *
     * @param item An album item.
     */
    public static fromAlbumItem(item: MusicResponsiveListItem): Track {
        const videoId = item.id!;
        const prepare = createYtDlpPrepare(videoId);
        const details = {
            url: videoURL(videoId, true),
            thumbnail: generateVideoThumbnailUrl(videoId),
            duration: item.duration!.seconds * 1000,
            author: {
                name: item.artists![0].name,
                url: item.artists![0].endpoint?.toURL(),
            },
        } satisfies TrackOptions;
        return new Track(prepare, item.title!.toString(), details);
    }
    /**
     * Returns whether the track has been resolved successfully.
     */
    public isResolved(): this is this & { resource: AudioResource<M>; } {
        return this.resource instanceof AudioResource;
    }
    /**
     * Returns whether the track has been prepared.
     */
    public isPrepared(): this is this & { resource: Promise<AudioResource<M> | null> | AudioResource<M> } {
        return this.audioResource != null;
    }
    /**
     * Reset the track which allows the audio resource to be created again.
     */
    public reset(): void {
        this.audioResource = null;
        this.error = null;
    }
    /**
     * Prepare the audio resource. If the resource is already being prepared, nothing will happen.
     */
    public prepare(): void {
        if (!this.isPrepared()) {
            this.audioResource = new Promise<AudioResource<M>>(resolve => { resolve(this.preparefn()) }).catch(error => { this.error = error; return null; });
        }
    }
    /**
     * Resolve the audio resource.
     */
    public async resolve(): Promise<AudioResource<M>> {
        if (this.isResolved()) {
            return this.resource as Promise<AudioResource<M>>;
        }
        this.prepare();
        this.audioResource = await this.resource;
        if (this.error != null || !this.isResolved()) {
            throw this.error ?? new Error('the resource could not be resolved to an AudioResource');
        }
        return this.resource as AudioResource<M>;
    }
    /**
     * Returns a APIEmbed representation of the track.
     *
     * @param fields Additional embed fields.
     */
    public toEmbed(...fields: RestOrArray<APIEmbedField>): APIEmbed {
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
export class Queue implements Iterable<Track<unknown>> {
    private readonly list: Track<unknown>[];
    public constructor() {
        this.list = [];
    }
    public get length(): number {
        return this.list.length;
    }
    public get duration(): number {
        return this.list.reduce((acc, track) => acc + (track.duration ?? 0), 0);
    }
    public [Symbol.iterator](): Iterator<Track<unknown>, BuiltinIteratorReturn, unknown> {
        return this.values();
    }
    public values(): ArrayIterator<Track<unknown>> {
        return this.list.values();
    }
    public push(value: Track): number {
        const length = this.list.push(value);
        if (this.list.length === 1) {
            value.prepare();
        }
        return length;
    }
    public shift(): Track<unknown> | undefined {
        const value = this.list.shift();
        if (this.list.length > 0) {
            this.list[0].prepare();
        }
        return value;
    }
    public get(index: number): Track<unknown> {
        if (index < 0 || index >= this.list.length) {
            throw new RangeError(`index ${index} is out of bounds`);
        }
        return this.list[index];
    }
    public set(index: number, value: Track<unknown>): void {
        if (index < 0 || index >= this.list.length) {
            throw new RangeError(`index ${index} is out of bounds`);
        }
        this.list[index] = value;
        if (index === 0) {
            value.prepare();
        }
    }
    public remove(index: number): Track<unknown> {
        if (index < 0 || index >= this.list.length) {
            throw new RangeError(`index ${index} is out of bounds`);
        }
        const value = this.list.splice(index, 1)[0];
        if (index === 0 && this.list.length > 0) {
            this.list[0].prepare();
        }
        return value;
    }
    public move(source: number, destination: number): void {
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
    public splice(start: number, deleteCount?: number): Track<unknown>[] {
        // explicitly passing undefined for deleteCount in Array.splice is converted to 0
        const part = this.list.splice(start, deleteCount ?? Infinity);
        if ((deleteCount == null || deleteCount > 0) && this.length > 0) {
            this.list[0].prepare();
        }
        return part;
    }
    public clear(): void {
        this.splice(0);
    }
    public shuffle(): void {
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
    private nowPlayingTrack: Track<unknown> | null;
    private volume: number;
    private subscription: PlayerSubscription | null;
    private connection: VoiceConnection | null;
    private audioPlayer: AudioPlayer;
    /**
     * The currently playing track.
     */
    public get nowPlaying(): Track<unknown> | null {
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
    public static of(guildId: Snowflake): Player {
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
    public isReady(): boolean {
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
    public isPaused(): boolean {
        return this.audioPlayer.state.status === AudioPlayerStatus.Paused;
    }
    /**
     * Returns the volume of the player.
     */
    public getVolume(): number {
        return this.volume;
    }
    /**
     * Set the volume of the player.
     *
     * @param value A percentage.
     */
    public setVolume(value: number): void {
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
    public setConnection(value: VoiceConnection | null): void {
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
    public async enqueue(track: Track): Promise<number> {
        if (!this.isPlaying()) {
            return this.play(track).then(() => 0).catch(() => -1);
        }
        return this.queue.push(track);
    }
    /**
     * Pauses the player.
     */
    public pause(): boolean {
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
    public unpause(): boolean {
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
    public stop(): void {
        this.queue.clear();
        this.loop = false;
        this.nowPlayingTrack = null;
        this.audioPlayer.stop(true);
    }
    /**
     * Skips the current track.
     */
    public async skip(): Promise<Track<unknown> | null> {
        this.loop = false;
        const track = this.nowPlaying;
        await this.next();
        return track;
    }
    /**
     * Destroys the player.
     */
    public destroy(): void {
        this.stop();
        Player.cache.delete(this.guildId);
    }
    public getEmbed(page: number): APIEmbed | null {
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

    private async next(): Promise<void> {
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
    private async play(track: Track<unknown>): Promise<void> {
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
const downloads = {} as Record<string, Promise<string>>;

const DefaultCreateAudioResourceOptions = {
    inlineVolume: true
} satisfies CreateAudioResourceOptions<null>;

function createDownloadPrepare(id: string, fn: (path: string) => Promise<string>): PrepareFunction {
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

function createStreamPrepare(id: string, fn: () => Promise<Readable>): PrepareFunction {
    const file = path.join(AUDIO_CACHE_DIR, `${id}.webm`);
    return async function prepare() {
        if (existsSync(file)) {
            // use prior downloaded tracks even in streams as they are more reliable
            return createAudioResource(file, DefaultCreateAudioResourceOptions);
        } else {
            return fn().then(stream => createAudioResource(stream, DefaultCreateAudioResourceOptions));
        }
    }
}

// yt-dlp

function createYtDlpPrepare(videoId: string, download = SHOULD_DOWNLOAD): PrepareFunction {
    if (download) {
        return createDownloadPrepare(videoId, (path: string) => {
            let attempts = 0;
            while (attempts < MAX_RETRIES) {
                try {
                    return downloadAudio(videoId, path);
                } catch {
                    attempts++;
                }
            }
            throw new Error('Audio download failed after 5 attempts.');
        });
    } else {
        return createStreamPrepare(videoId, () => getStreamingURL(videoId).then(url => fetch(url)).then(res => Readable.fromWeb(res.body! as ReadableStream)));
    }
}

function downloadAudio(videoId: string, path: string): Promise<string> {
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
        proc.stderr.pipe(process.stderr);

        proc.once('error', (error) => {
            reject(error);
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
                if (existsSync(path)) {
                    rmSync(path);
                }
                reject(`yt-dlp exited with code ${code}.`);
            }
        });
    });
}

function getStreamingURL(videoId: string): Promise<string> {
    // resolve the streaming URL from yt-dlp
    return new Promise<string>((resolve, reject) => {
        exec(`yt-dlp -f bestaudio --get-url ${videoId.startsWith('-') ? videoURL(videoId) : videoId}`, (error, stdout) => {
            if (error) {
                reject(error);
            } else {
                resolve(stdout.trim());
            }
        });
    });
}
