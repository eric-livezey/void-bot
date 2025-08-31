import { joinVoiceChannel } from '@discordjs/voice';
import { Snowflake, VoiceBasedChannel } from 'discord.js';
import { getInnertubeInstance } from './innertube';

export class Duration {
    private milliseconds: number;

    /**
     * Construct a new {@link Duration} with `milliseconds` milliseconds.
     * 
     * @param milliseconds the total number of milliseconds
     */
    public constructor(milliseconds: number) {
        this.milliseconds = milliseconds;
    }
    /**
     * Returns the formatted version of a duration with `milliseconds` milliseconds.
     * 
     * Equivalent to:
     * ```js
     * new Duration(milliseconds).format(includeMillis);
     * ```
     * 
     * @param milliseconds the total number of milliseconds
     * @param includeMillis whether the millisecond should be included
     */
    public static format(milliseconds: number, includeMillis = false) {
        return new Duration(milliseconds).format(includeMillis);
    }
    /**
     * Returns the total number of milliseconds.
     */
    public getMilliseconds() {
        return this.milliseconds;
    }
    /**
     * Set the total number of milliseconds.
     * 
     * @param milliseconds the total number of milliseconds
     */
    public setMilliseconds(milliseconds: number) {
        this.milliseconds = Math.floor(milliseconds);
    }
    /**
     * Returns the total number of seconds.
     */
    public getSeconds() {
        return this.getMilliseconds() / 1000;
    }
    /**
     * Set the total number of seconds.
     * 
     * @param seconds the total number of seconds
     */
    public setSeconds(seconds: number) {
        this.setMilliseconds(seconds * 1000);
    }
    /**
     * Returns the total number of minutes.
     */
    public getMinutes() {
        return this.getMilliseconds() / 60000;
    }
    /**
     * Set the total number of minutes.
     * 
     * @param minutes the total number of minutes
     */
    public setMinutes(minutes: number) {
        this.setMilliseconds(minutes * 60000);
    }
    /**
     * Returns the total number of hours.
     */
    public getHours() {
        return this.getMilliseconds() / 3.6e+6;
    }
    /**
     * Set the total number of hours.
     * 
     * @param hours the total number of hours
     */
    public setHours(hours: number) {
        this.setMilliseconds(hours * 3.6e+6);
    }
    /**
     * Returns the total number of days.
     */
    public getDays() {
        return this.getMilliseconds() / 8.64e+7;
    }
    /**
     * Set the total number of days.
     * 
     * @param days the total number of days
     */
    public setDays(days: number) {
        this.setMilliseconds(days * 8.64e+7);
    }
    /**
     * Returns the millisecond.
     */
    public getMillisecond() {
        return this.getMilliseconds() % 1000;
    }
    /**
     * Set the millisecond.
     * 
     * @param millisecond the millisecond
     */
    public setMillisecond(millisecond: number) {
        this.setDay(this.getDay(), this.getHour(), this.getMinute(), this.getSecond(), millisecond);
    }
    /**
     * Returns the second.
     */
    public getSecond() {
        return Math.floor(this.getMilliseconds() % 60000 / 1000);
    }
    /**
     * Set the second.
     * 
     * @param second the second
     * @param millisecond the millisecond
     */
    public setSecond(second: number, millisecond?: number) {
        this.setDay(this.getDay(), this.getHour(), this.getMinute(), second, millisecond);
    }
    /**
     * Returns the minute.
     */
    public getMinute() {
        return Math.floor(this.getMilliseconds() % 3.6e+6 / 60000);
    }
    /**
     * Set the minute.
     * 
     * @param minute the minute
     * @param second the second
     * @param millisecond the millisecond
     */
    public setMinute(minute: number, second?: number, millisecond?: number) {
        this.setDay(this.getDay(), this.getHour(), minute, second, millisecond);

    }
    /**
     * Returns the hour.
     */
    public getHour() {
        return Math.floor(this.getMilliseconds() % 8.64e+7 / 3.6e+6);
    }
    /**
     * Set the hour.
     * 
     * @param hour the hour
     * @param minute the minute
     * @param second the second
     * @param millisecond the millisecond
     */
    public setHour(hour: number, minute?: number, second?: number, millisecond?: number) {
        this.setDay(this.getDay(), hour, minute, second, millisecond);
    }
    /**
     * Returns the day.
     */
    public getDay() {
        return Math.floor(this.getDays());
    }
    /**
     * Set the day.
     * 
     * @param day the day
     * @param hour the hour
     * @param minute this minute
     * @param second the second
     * @param millisecond the millisecond
     */
    public setDay(day: number, hour?: number, minute?: number, second?: number, millisecond?: number) {
        if (hour === undefined) {
            hour = this.getHour();
        }
        if (minute === undefined) {
            minute = this.getMinute();
        }
        if (second === undefined) {
            second = this.getSecond();
        }
        if (millisecond === undefined) {
            millisecond = this.getMillisecond();
        }
        this.setMilliseconds(Math.floor(this.getMilliseconds() / 8.64e+7) + day * 8.64e+7 + hour * 3.6e+6 + minute * 60000 + second * 1000 + millisecond);
    }
    /**
     * Returns the formatted duration.
     * 
     * @param includeMillis weather the millisecond should be included
     */
    public format(includeMillis = false) {
        let str = `${zeroFill(this.getMinute())}:${zeroFill(this.getSecond())}`;
        if (includeMillis) {
            str += '.' + zeroFill(this.getMillisecond(), 3);
        }
        let prefix = '';
        for (const value of [this.getDay(), this.getHour()]) {
            if (prefix || value > 0) {
                prefix += (prefix ? zeroFill(value) : value) + ':';
            }
        }
        return prefix + str;
    }
    public toString() {
        return this.format();
    }
}
function zeroFill(value: number, maxLength = 2) {
    return value.toString().padStart(maxLength, '0');
}

/**
 * Resolves a snowflake from a string.
 * 
 * @param input A string.
 * @returns The snowflake or `null`.
 */
export function resolveSnowflake(input: string): Snowflake | null {
    return input.match(/^[0-9]{1,20}$/)?.[0] ?? null;
}
/**
 * Resolves a user ID from a mention or snowflake.
 * 
 * @param input A string.
 * @returns The user ID or `null`.
 */
export function resolveUserId(input: string): Snowflake | null {
    return input.match(/^<@\d{1,20}>$/)?.[1] ?? resolveSnowflake(input);
}
/**
 * Resolves a channel ID from a mention or snowflake.
 * 
 * @param input A string.
 * @returns The channel ID or `null`.
 */
export function resolveChannelId(input: string): Snowflake | null {
    return input.match(/^<#\d{1,20}>$/)?.[1] ?? resolveSnowflake(input);
}
/**
 * Resolves a role ID from a mention or snowflake.
 * 
 * @param input A string.
 * @returns The role ID or `null`.
 */
export function resolveRoleId(input: string): Snowflake | null {
    return input.match(/^<#\d{1,20}>$/)?.[1] ?? resolveSnowflake(input);
}
export function createVoiceConnection(channel: VoiceBasedChannel) {
    const connection = joinVoiceChannel({
        channelId: channel.id,
        guildId: channel.guildId,
        adapterCreator: channel.guild.voiceAdapterCreator,
        selfDeaf: false
    });
    connection.on('error', e => {
        console.warn('A voice connection error occurred.\nAttempting to rejoin...');
        while (connection.rejoinAttempts < 5) {
            if (connection.rejoin()) {
                console.log('Rejoin was successful.');
                return;
            }
        }
        console.error('Rejoin failed after 5 attempts with the following error:');
        connection.destroy();
        console.error(e);
    });
    return connection;
}

enum WebPageType {
    Watch = 'WEB_PAGE_TYPE_WATCH',
    Channel = 'WEB_PAGE_TYPE_CHANNEL',
    Playlist = 'WEB_PAGE_TYPE_PLAYLIST',
}
const validProtocols = new Set(['http:', 'https:']);
const validHostnames = new Set(['www.youtube.com', 'youtube.com', 'm.youtube.com', 'music.youtube.com']);
const shortUrlHostname = 'youtu.be';
const videoIdRegexp = /^[\w-]{11}$/;
const channelIdRegexp = /^[\w-]{24}$/;
/**
 * Resolves a url from a string.
 * 
 * @param input A string.
 * @returns The parsed URL or `null`.
 */
export function resolveURL(input: string): URL | null {
    return URL.canParse(input) ? new URL(input) : null;
}
/**
 * Returns whether a URL has a valid domain and protocol for a YouTube URL.
 * 
 * @param url A URL.
 * @param allowShort Allow short urls. Default `false`.
 * @returns `true` if the URL corresponds to a YouTube URL, else `false`.
 */
export function isYouTubeURL(url: URL, allowShort = false): boolean {
    return validProtocols.has(url.protocol) && validHostnames.has(url.hostname) || allowShort && url.hostname === shortUrlHostname;
}
/**
 * Extracts the video ID from a URL.
 * 
 * @param url A URL.
 * @returns The video ID if resolved, else `null`.
 */
export function extractVideoId(url: URL): string | null {
    if (isYouTubeURL(url, true)) {
        const [, a, b, c] = url.pathname.split('/');
        if (c == null) {
            if (a === 'watch') {
                return b == null ? url.searchParams.get('v') : b ?? null;
            }
            if (a === 'shorts') {
                return b;
            }
            if (url.hostname === shortUrlHostname && b == null) {
                return a ?? null;
            }
        }
    }
    return null;
}
/**
 * Extracts the playlist ID from a URL.
 * 
 * @param url A URL.
 * @returns The playlist ID if resolved, else `null`.
 */
export function extractPlaylistId(url: URL): string | null {
    if (isYouTubeURL(url) && url.pathname === '/playlist') {
        return url.searchParams.get('list');
    }
    return null;
}
/**
 * Extracts the channel ID from a URL.
 * 
 * @param url A URL.
 * @returns The channel ID if resolved, else `null`.
 */
export function extractChannelId(url: URL): string | null {
    if (isYouTubeURL(url)) {
        const [, a, b] = url.pathname.split('/');
        if (a === 'channel') {
            return b ?? null;
        }
    }
    return null;
}
/**
 * Resolves a video ID from a string.
 * 
 * @param input A string.
 * @returns The video ID or `null`.
 */
export function resolveVideoId(input: string): string | null {
    const url = resolveURL(input);
    const videoId = url ? extractVideoId(url) : input;
    if (videoId != null && videoIdRegexp.test(videoId)) {
        return videoId;
    }
    return null;
}
/**
 * Resolves a channel ID from a string.
 * 
 * **NOTE**: This only works on links which contain the channel ID.
 * 
 * @param input A string.
 * @returns The channel ID or `null`.
 */
export function resolveYouTubeChannelId(input: string): string | null {
    const url = resolveURL(input);
    const channelId = url ? extractChannelId(url) : input;
    if (channelId != null && channelIdRegexp.test(channelId)) {
        return channelId;
    }
    return null;
}
/**
 * Gets a channel ID from a string.
 * 
 * @param input A string.
 * @returns The channel ID or `null`.
 */
export async function getYouTubeChannelId(input: string) {
    let channelId = input;
    const url = resolveURL(input);
    if (url && isYouTubeURL(url)) {
        const [, a, b] = url.pathname.split('/');
        if (a === 'channel') {
            channelId = b ?? null;
        } else {
            const innertube = await getInnertubeInstance();
            const endpoint = await innertube.resolveURL(url.toString()).catch(() => null);
            if (endpoint?.metadata.page_type === WebPageType.Channel) {
                channelId = endpoint.payload.browseId ?? null;
            }
        }
    }
    return channelId != null && channelIdRegexp.test(channelId) ? channelId : null;

}
export function videoURL(videoId: string, short = false) {
    if (short) {
        return `https://youtu.be/${encodeURIComponent(videoId)}`;
    } else {
        return `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
    }
}
export function playlistURL(playlistId: string) {
    return `https://www.youtube.com/playlist?list=${encodeURIComponent(playlistId)}`;
}
export function channelURL(channelId: string) {
    return `https://www.youtube.com/channel/${encodeURIComponent(channelId)}`;
}
export interface Thumbnail {
    /**
     * The image's URL.
     */
    url: string;
    /**
     * The image's width.
     */
    width: number;
    /**
     * The image's height.
     */
    height: number;
}
export enum ThumbnailQuality {
    Default = 'default',
    Medium = 'mqdefault',
    High = 'hqdefault',
    Standard = 'sddefault',
    MaxRes = 'maxresdefault',
}
const ThumbnailQualityDimensions = new Map<ThumbnailQuality, Pick<Thumbnail, 'width' | 'height'>>([
    [ThumbnailQuality.Default, { width: 120, height: 90 }],
    [ThumbnailQuality.Medium, { width: 320, height: 180 }],
    [ThumbnailQuality.High, { width: 480, height: 360 }],
    [ThumbnailQuality.Standard, { width: 640, height: 480 }],
    [ThumbnailQuality.MaxRes, { width: 1280, height: 720 }],
]);
/**
 * Generate a thumbnail for a YouTube video.
 * 
 * @param videoId YouTube video ID.
 * @param quality Thumbnail quality. Default {@link ThumbnailQuality.MaxRes MaxRes}.
 */
export function generateVideoThumbnail(videoId: string, quality = ThumbnailQuality.MaxRes): Thumbnail {
    return {
        url: `https://i.ytimg.com/vi/${videoId}/${quality}.jpg`,
        ...ThumbnailQualityDimensions.get(quality)!
    };
}
/**
 * Finds the highest resolution thumbnail in a list of thumbnails.
 * 
 * @param thumbnails A list of thumbnails.
 * @returns The highest resolution thumbnail.
 */
export function bestThumbnail(thumbnails: Thumbnail[]) {
    return thumbnails.reduce((best, current) => current.width * current.height > best.height * best.width ? current : best);
}
