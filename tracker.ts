import { _Nullable, CategoryChannel, CategoryChannelResolvable, ChannelType, Client, Events, Guild, PermissionsBitField, Snowflake, VoiceChannel } from 'discord.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import Innertube from 'youtubei.js/agnostic';
import { PageHeader } from 'youtubei.js/dist/src/parser/nodes';
import { Channel } from 'youtubei.js/dist/src/parser/youtube';
import { getInnertubeInstance } from './innertube';

/**
 * Path to the tracker cache file.
 */
const TRACKER_CACHE = path.join('cache', 'trackers.json');
const TRACKER_CACHE_DIR = path.dirname(TRACKER_CACHE);
/**
 * Default interval at which resources are updated in milliseconds.
 */
const DefaultDelay = 60_000;

export enum ResourceType {
    /**
     * YouTube video resource.
     */
    Video,
    /**
     * YouTube channel resource.
     */
    Channel,
}

/**
 * Identifier for a tracker.
 */
interface TrackerIdentifier {
    /**
     * Type of tracked resource.
     */
    type: ResourceType;
    /**
     * ID of the guild.
     */
    guildId: string;
    /**
     * ID of the associated resource.
     */
    resourceId: string;

}

/**
 * A cached tracker stored locally on the disk.
 */
interface JSONTracker extends TrackerIdentifier {
    /**
     * ID of the category channel.
     */
    categoryChannelId?: string;
    /**
     * ID of the detail channel.
     */
    detailChannelId?: string;
}

interface TrackerDetails {
    title: string;
    detail: string;
}

interface BaseCreateChannelOptions {
    guild?: Guild;
    innertube?: Innertube;
    details?: TrackerDetails;
}

interface CreateCategoryChannelOptions extends BaseCreateChannelOptions {
    title?: string;
}

interface CreateDetailChannelOptions extends BaseCreateChannelOptions {
    detail?: string;
}

interface TrackerChannels {
    categoryChannel: CategoryChannel;
    detailChannel: VoiceChannel;
}

type Trackers = {
    [ResourceType.Video]: VideoTracker;
    [ResourceType.Channel]: ChannelTracker;
}

function getTrackers(client: Client) {
    const trackers = new Map<Snowflake, Map<ResourceType, Map<string, ResourceTracker>>>();
    if (existsSync(TRACKER_CACHE)) {
        const buffer = readFileSync(TRACKER_CACHE);
        const data = JSON.parse(buffer.toString('utf8')) as JSONTracker[];
        for (const json of data) {
            const { type, guildId, resourceId: id } = json;
            if (!trackers.has(guildId)) {
                trackers.set(guildId, new Map());
            }
            const guildTrackers = trackers.get(guildId)!;
            if (!guildTrackers.has(type)) {
                guildTrackers.set(type, new Map());
            }
            const resourceTrackers = guildTrackers.get(type)!;
            resourceTrackers.set(id, ResourceTracker.fromJSON(client, json));
        }
    }
    return trackers;
}

function saveTrackers(trackers: ResourceTracker[]) {
    if (!existsSync(TRACKER_CACHE_DIR)) {
        mkdirSync(TRACKER_CACHE_DIR, { recursive: true });
    }
    writeFileSync(TRACKER_CACHE, JSON.stringify(trackers.map(tracker => tracker.toJSON())));
}

async function createCategoryChannel(tracker: TrackerIdentifier, guild: Guild, title: string) {
    const channel = await guild.channels.create({ name: title, type: ChannelType.GuildCategory, permissionOverwrites: [{ id: guild.roles.everyone, deny: [PermissionsBitField.Flags.Connect] }] });
    CHANNEL_MAP.set(channel.id, tracker);
    return channel;
}

async function createDetailChannel(tracker: TrackerIdentifier, guild: Guild, detail: string, parent: CategoryChannelResolvable) {
    const channel = await guild.channels.create({ name: detail, type: ChannelType.GuildVoice, parent });
    CHANNEL_MAP.set(channel.id, tracker);
    return channel;
}

async function createChannels(tracker: TrackerIdentifier, guild: Guild, title: string, detail: string): Promise<TrackerChannels> {
    const categoryChannel = await createCategoryChannel(tracker, guild, title);
    const detailChannel = await createDetailChannel(tracker, guild, detail, categoryChannel);
    return { categoryChannel, detailChannel };
}

function formatViewCount(n: number) {
    return n > 1e9 ? Math.floor(n / 1e8) / 10 + "B" : n > 1e6 ? Math.floor(n / 1e5) / 10 + "M" : n.toLocaleString();
}

abstract class ResourceTracker {
    public readonly client: Client;
    public readonly guildId: string;
    public readonly type: ResourceType;
    public readonly resourceId: string;
    public categoryChannelId: Snowflake | null;
    public detailChannelId: Snowflake | null;
    private details: Partial<TrackerDetails> | null;
    public get title() {
        return this.details?.title ?? null;
    }
    public get detail() {
        return this.details?.detail ?? null;
    }
    private get identifier(): TrackerIdentifier {
        return {
            type: this.type,
            guildId: this.guildId,
            resourceId: this.resourceId,
        };
    }

    public constructor(client: Client, guildId: string, type: ResourceType, resourceId: string, categoryChannelId?: string, detailChannelId?: string) {
        this.client = client;
        this.guildId = guildId;
        this.type = type;
        this.resourceId = resourceId;
        if (categoryChannelId != null) {
            CHANNEL_MAP.set(categoryChannelId, this.identifier);
            this.categoryChannelId = categoryChannelId;
        } else {
            this.categoryChannelId = null;
        }
        if (detailChannelId != null) {
            CHANNEL_MAP.set(detailChannelId, this.identifier);
            this.detailChannelId = detailChannelId;
        } else {
            this.detailChannelId = null;
        }
        this.details = null;
    }

    protected abstract fetchDetails(innertube?: Innertube): Promise<Partial<TrackerDetails>>;
    private async fetchDetailsAndUpdateCache(innertube?: Innertube) {
        let { title, detail } = await this.fetchDetails(innertube);
        title ??= this.details?.detail;
        detail ??= this.details?.title;
        return this.details = { title, detail };
    }
    private async createCategoryChannel(options?: CreateCategoryChannelOptions) {
        const guild = options?.guild ?? await this.client.guilds.fetch(this.guildId);
        const title = options?.title ?? (options?.details ?? await this.fetchDetailsAndUpdateCache(options?.innertube)).title ?? this.title;
        return { id: this.categoryChannelId } = await createCategoryChannel(this.identifier, guild, title ?? 'Unknown');
    }
    private async createDetailChannel(parent: CategoryChannelResolvable, options?: CreateDetailChannelOptions) {
        const guild = options?.guild ?? await this.client.guilds.fetch(this.guildId);
        const detail = options?.detail ?? (options?.details ?? await this.fetchDetailsAndUpdateCache(options?.innertube)).detail ?? this.detail;
        return { id: this.detailChannelId } = await createDetailChannel(this.identifier, guild, detail ?? 'Unknown', parent);
    }
    private async createChannels(options?: CreateCategoryChannelOptions & CreateDetailChannelOptions) {
        const guild = options?.guild ?? await this.client.guilds.fetch(this.guildId);
        const title = options?.title;
        const detail = options?.detail;
        let details: Partial<TrackerDetails> | undefined = options?.details;
        if (title == null || detail == null) {
            details ??= await this.fetchDetailsAndUpdateCache(options?.innertube);
        }
        return { categoryChannel: { id: this.categoryChannelId }, detailChannel: { id: this.detailChannelId } } = await createChannels(this.identifier, guild, title ?? details!.title ?? 'Unknown', detail ?? details!.detail ?? 'Unknown');
    }
    private async fetchChannels(): Promise<_Nullable<TrackerChannels>> {
        const { channels } = this.client;
        const { categoryChannelId, detailChannelId } = this;
        return {
            categoryChannel: categoryChannelId != null ? await channels.fetch(categoryChannelId).catch(() => null) as CategoryChannel | null : null,
            detailChannel: detailChannelId != null ? await channels.fetch(detailChannelId).catch(() => null) as VoiceChannel | null : null,
        }
    }
    public async deleteChannels() {
        const { categoryChannel, detailChannel } = await this.fetchChannels();
        for (const channel of [categoryChannel, detailChannel]) {
            if (channel) {
                CHANNEL_MAP.delete(channel.id);
            }
            if (channel?.deletable) {
                await channel.delete();
            }
        }
    }
    public async update() {
        let guild, { categoryChannel, detailChannel } = await this.fetchChannels();
        const { title, detail } = await this.fetchDetailsAndUpdateCache();
        // if neither channel is resolved, create channel
        if (!categoryChannel && !detailChannel) {
            ({ categoryChannel, detailChannel } = await this.createChannels({
                guild: guild ??= await this.client.guilds.fetch(this.guildId),
                title,
                detail,
            }));
        }
        // if the category channel is not resolved, create it
        if (!categoryChannel) {
            categoryChannel = await this.createCategoryChannel({
                guild: guild ??= await this.client.guilds.fetch(this.guildId),
                title,
            });
        }
        // if the detail channel is not resolved, create it
        if (!detailChannel) {
            detailChannel = await this.createDetailChannel(categoryChannel, {
                guild: guild ??= await this.client.guilds.fetch(this.guildId),
                detail,
            });
        }
        // if the detail channel is not a child of the category channel, move it
        if (detailChannel.parentId !== categoryChannel.id) {
            await detailChannel.edit({ parent: categoryChannel });
        }
        // if the category channel's name is not the current title, change it
        if (title != null && categoryChannel.name !== title) {
            await categoryChannel.setName(title);
        }
        // if the detail channel's name is not the current detail, change it
        if (detail != null && detailChannel.name !== detail) {
            await detailChannel.setName(detail);
        }
    }
    public isVideo(): this is VideoTracker {
        return this instanceof VideoTracker;
    }
    public toJSON(): JSONTracker {
        return {
            type: this.type,
            guildId: this.guildId,
            categoryChannelId: this.categoryChannelId ?? undefined,
            detailChannelId: this.detailChannelId ?? undefined,
            resourceId: this.resourceId
        }
    }
    public static fromJSON(client: Client, json: JSONTracker): ResourceTracker {
        switch (json.type) {
            case ResourceType.Video:
                return VideoTracker.fromJSON(client, json);
            case ResourceType.Channel:
                return ChannelTracker.fromJSON(client, json);
        }
    }
}

class VideoTracker extends ResourceTracker {
    public get videoId() {
        return this.resourceId;
    }

    constructor(client: Client, guildId: string, videoId: string, categoryChannelId?: string, detailChannelId?: string) {
        super(client, guildId, ResourceType.Video, videoId, categoryChannelId, detailChannelId);
    }

    protected async fetchDetails(innertube?: Innertube) {
        innertube ??= await getInnertubeInstance();
        const { basic_info: { title, view_count: viewCount } } = await innertube.getBasicInfo(this.resourceId);
        return { title, detail: viewCount != null ? `${formatViewCount(viewCount)} views` : undefined };
    }
    public static fromJSON(client: Client, json: JSONTracker) {
        return new this(client, json.guildId, json.resourceId, json.categoryChannelId, json.detailChannelId);
    }
}

class ChannelTracker extends ResourceTracker {
    public get channelId() {
        return this.resourceId;
    }

    constructor(client: Client, guildId: string, channelId: string, categoryChannelId?: string, detailChannelId?: string) {
        super(client, guildId, ResourceType.Channel, channelId, categoryChannelId, detailChannelId);
    }

    protected async fetchDetails(innertube?: Innertube) {
        innertube ??= await getInnertubeInstance();
        const channel = await innertube.getChannel(this.resourceId) as Channel & { header?: PageHeader };
        return { title: channel.metadata.title, detail: channel.header?.content?.metadata?.metadata_rows[1]?.metadata_parts?.[0]?.text?.toString() };
    }
    public static fromJSON(client: Client, json: JSONTracker) {
        return new this(client, json.guildId, json.resourceId, json.categoryChannelId, json.detailChannelId);
    }
}

/**
 * Map of channel IDs to their related resource identifiers.
 */
const CHANNEL_MAP = new Map<Snowflake, TrackerIdentifier>();

export class TrackerManager {
    private static readonly cache: Map<Client, TrackerManager> = new Map();
    private readonly client: Client;
    private readonly trackers: Map<Snowflake, Map<ResourceType, Map<string, ResourceTracker>>>;
    private timeout: NodeJS.Timeout | null;
    public get isRunning() {
        return this.timeout != null;
    }

    public constructor(client: Client) {
        this.client = client;
        this.trackers = getTrackers(client);
        this.timeout = null;
        client.on(Events.ChannelDelete, async ({ id }) => {
            const tracker = CHANNEL_MAP.get(id);
            CHANNEL_MAP.delete(id);
            if (tracker) {
                await this.delete(tracker.guildId, tracker.type, tracker.resourceId).catch(console.error);
            }
        });
    }

    public static of(client: Client) {
        if (!this.cache.has(client)) {
            this.cache.set(client, new TrackerManager(client));
        }
        return this.cache.get(client)!;
    }
    private mapForGuild(guildId: string) {
        if (!this.trackers.has(guildId)) {
            this.trackers.set(guildId, new Map());
        }
        return this.trackers.get(guildId)!;
    }
    private mapForType(guildId: string, type: ResourceType) {
        const map = this.mapForGuild(guildId);

        if (!map.has(type)) {
            map.set(type, new Map());
        }
        return map.get(type)!;
    }
    private has(guildId: string, type: ResourceType, resourceId: string) {
        return this.trackers.get(guildId)?.get(type)?.has(resourceId) === true;
    }
    private get<T extends ResourceType>(guildId: string, type: T, resourceId: string) {
        return this.trackers.get(guildId)?.get(type)?.get(resourceId) as Trackers[T] | undefined ?? null;
    }
    private set<T extends ResourceType>(guildId: string, type: T, resourceId: string, tracker: Trackers[T]) {
        this.mapForType(guildId, type).set(resourceId, tracker);
        this.save();
    }
    private async delete(guildId: string, type: ResourceType, resourceId: string) {
        const guildTrackers = this.trackers.get(guildId);
        if (guildTrackers) {
            const resourceTrackers = guildTrackers.get(type);
            if (resourceTrackers) {
                const tracker = resourceTrackers.get(resourceId);
                if (tracker) {
                    // delete the tracker
                    resourceTrackers.delete(resourceId);
                    // delete the tracker's channels
                    await tracker.deleteChannels();
                    // if there are no more trackers for the type, delete the map
                    if (resourceTrackers.size === 0) {
                        guildTrackers.delete(type);
                        // if there are no more trackers in the guild, delete the map
                        if (guildTrackers.size === 0) {
                            this.trackers.delete(guildId);
                        }
                    }
                    // save trackers to the disk
                    this.save();
                }
            }
        }
    }
    /**
     * Start tracking.
     * 
     * @param delay the delay at which to update trackers in milliseconds.
     */
    public start(delay = DefaultDelay) {
        if (!this.timeout) {
            this.update();
            this.timeout = setInterval(this.update.bind(this), delay);
        } else {
            console.warn('[WARNING]', 'start() was called more than once on a single TrackerManager without calling stop().');
        }
    }
    /**
     * Stops tracking.
     */
    public stop() {
        if (this.timeout?.close()) {
            this.timeout = null;
        } else {
            console.warn('[WARNING]', 'stop() was called on a TrackerManager while it was already stopped.');
        }
    }
    /**
     * Update all trackers and related channels.
     */
    public async update() {
        const promises = [];
        for (const guildTrackers of this.trackers.values()) {
            for (const resourceTrackers of guildTrackers.values()) {
                for (const tracker of resourceTrackers.values()) {
                    promises.push(tracker.update().catch(() => { }));
                }
            }
        }
        await Promise.all(promises);
    }
    /**
     * Save trackers to the disk.
     */
    public save() {
        const trackers = [];
        for (const guildTrackers of this.trackers.values()) {
            for (const resourceTrackers of guildTrackers.values()) {
                for (const tracker of resourceTrackers.values()) {
                    trackers.push(tracker);
                }
            }
        }
        saveTrackers(trackers);
    }
    public hasVideoTracker(guildId: string, videoId: string) {
        return this.has(guildId, ResourceType.Video, videoId);
    }
    public getVideoTracker(guildId: string, videoId: string) {
        return this.get(guildId, ResourceType.Video, videoId);
    }
    public async addVideoTracker(guildId: string, videoId: string) {
        let tracker = this.getVideoTracker(guildId, videoId);
        if (tracker) {
            return tracker;
        }
        tracker = new VideoTracker(this.client, guildId, videoId);
        await tracker.update();
        this.set(guildId, ResourceType.Video, videoId, tracker);
        return tracker;
    }
    public async removeVideoTracker(guildId: string, videoId: string) {
        await this.delete(guildId, ResourceType.Video, videoId);
    }
    public hasChannelTracker(guildId: string, videoId: string) {
        return this.has(guildId, ResourceType.Channel, videoId);
    }
    public getChannelTracker(guildId: string, videoId: string) {
        return this.get(guildId, ResourceType.Channel, videoId);
    }
    public async addChannelTracker(guildId: string, videoId: string) {
        let tracker = this.getChannelTracker(guildId, videoId);
        if (tracker) {
            return tracker;
        }
        tracker = new ChannelTracker(this.client, guildId, videoId);
        await tracker.update();
        this.set(guildId, ResourceType.Channel, videoId, tracker);
        return tracker;
    }
    public async removeChannelTracker(guildId: string, videoId: string) {
        await this.delete(guildId, ResourceType.Channel, videoId);
    }
}
