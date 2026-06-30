import { Collection, GuildMember, InteractionCallbackResponse, Message, MessagePayload, type BooleanCache, type ChatInputCommandInteraction, type Client, type Guild, type GuildTextBasedChannel, type If, type InteractionDeferReplyOptions, type InteractionEditReplyOptions, type InteractionReplyOptions, type InteractionResponse, type MessageEditOptions, type MessagePayloadOption, type MessageReplyOptions, type MessageResolvable, type OmitPartialGroupDMChannel, type Snowflake, type TextBasedChannel, type User } from 'discord.js';
import { Player } from './player.js';
import { TrackerManager } from './tracker.js';
import { cacheThumbnailURL, isOwner, normalizeURL } from './utils.js';

export type MessageOptions = MessagePayloadOption;
export type MessageOptionsResolvable = string | MessageOptions | MessagePayload;

function split(str: string, regex: RegExp, limit?: number): string[] {
    const result = [];
    let match;
    let lastIndex = 0;
    while ((match = regex.exec(str)) && (limit === undefined || result.length < limit - 1)) {
        const endIndex = match.index;
        result.push(str.slice(lastIndex, endIndex));
        lastIndex = endIndex + match[0].length;
    }
    result.push(str.slice(lastIndex));
    return result;
}

function cacheMessageThumbnailURL(key: string, message: Message) {
    const thumbnail = message.embeds[0]?.thumbnail;
    if (thumbnail) {
        cacheThumbnailURL(key, normalizeURL(thumbnail.url));
    }
}

/**
 * Represents the context in which a command was sent.
 */
export abstract class CommandContext<InGuild extends boolean = boolean> {
    /**
     * The discord client associated with the command.
     */
    public abstract readonly client: Client<true>;
    /**
     * The name of the command.
     */
    public abstract readonly commandName: string;
    /**
     * The ID of the user who invoked the command.
     */
    public abstract readonly userId: Snowflake;
    /**
     * The ID of the text channel in which the command was invoked.
     */
    public abstract readonly channelId: Snowflake;
    /**
     * If applicable, the ID of the guild in which the command was invoked.
     */
    public abstract readonly guildId: If<InGuild, Snowflake>;
    /**
     * The user who invoked the command.
     */
    public abstract readonly user: User;
    /**
     * The text channel in which the command was invoked.
     */
    public abstract readonly channel: If<InGuild, GuildTextBasedChannel, TextBasedChannel>;
    /**
     * If applicable, the guild in which the command was invoked.
     */
    public abstract readonly guild: If<InGuild, Guild>;
    /**
     * If applicable, the guild member who invoked the command.
     */
    public abstract readonly member: If<InGuild, GuildMember>;
    /**
     * `true` if the command has been replied to.
     */
    public abstract readonly replied: boolean;
    public get player(): If<InGuild, Player> {
        return (this.inGuild() ? Player.of(this.guildId) : null) as If<InGuild, Player>;
    }
    public get trackers(): TrackerManager {
        return TrackerManager.of(this.client);
    }

    public isOwner(): boolean {
        return isOwner(this.userId);
    }
    /**
     * Returns `true` if the command was executed from a slash command.
     */
    public isSlashCommand(): this is SlashCommandContext<InGuild> {
        return this instanceof SlashCommandContext;
    }
    /**
     * Returns `true` if the command was executed from a message.
     */
    public isMessageCommand(): this is MessageCommandContext<InGuild> {
        return this instanceof MessageCommandContext;
    }
    /**
     * Returns `true` if the command was executed in a guild.
     */
    public abstract inGuild(): this is CommandContext<true>;
    /**
     * Reply to the command.
     * 
     * @param options Message options
     */
    public abstract reply(options: MessageOptionsResolvable, thumbnailKey?: string): Promise<InteractionCallbackResponse<InGuild> | InteractionResponse<BooleanCache<GuildCacheType<InGuild>>> | Message<InGuild>>;
    /**
     * Edit the latest reply to the command.
     * 
     * @param options Message options
     */
    public abstract editReply(options: MessageOptionsResolvable, thumbnailKey?: string): Promise<Message<InGuild>>;
    /**
     * Send a follow-up to the command.
     * 
     * @param options Message options
     */
    public abstract followUp(options: MessageOptionsResolvable, thumbnailKey?: string): Promise<Message<InGuild>>;
    /**
     * Deletes a reply to the command.
     * 
     * @param options The message to delete
     */
    public abstract deleteReply(options?: MessageResolvable): Promise<void>;
    /**
     * Reply or follow-up to the command.
     * 
     * @param options Message options
     */
    public replyOrFollowUp(options: MessageOptionsResolvable, thumbnailKey?: string): Promise<InteractionCallbackResponse<InGuild> | InteractionResponse<BooleanCache<GuildCacheType<InGuild>>> | Message<InGuild>> {
        if (!this.replied) {
            return this.reply(options, thumbnailKey);
        }
        return this.followUp(options, thumbnailKey);
    }
}

type GuildCacheType<InGuild extends boolean> = If<InGuild, 'cached' | 'raw', undefined>;

export class SlashCommandContext<InGuild extends boolean = boolean> extends CommandContext<InGuild> {
    public get client(): Client<true> {
        return this.interaction.client;
    }
    public get commandName(): string {
        return this.interaction.commandName;
    }
    public get userId(): Snowflake {
        return this.user.id;
    }
    public get channelId(): Snowflake {
        return this.interaction.channelId;
    }
    public get guildId(): If<InGuild, Snowflake> {
        return this.interaction.guildId as If<InGuild, Snowflake>;
    }
    public get user(): User {
        return this.interaction.user;
    }
    public get channel(): If<InGuild, GuildTextBasedChannel, TextBasedChannel> {
        return this.interaction.channel as If<InGuild, GuildTextBasedChannel, TextBasedChannel>;
    }
    public get guild(): If<InGuild, Guild> {
        return this.interaction.guild as If<InGuild, Guild>;
    }
    public get member(): If<InGuild, GuildMember> {
        const member = this.interaction.member;
        if (member === null) {
            return null as If<InGuild, GuildMember>;
        }
        if (member instanceof GuildMember) {
            return (this.guild?.members.resolve(member) ?? null) as If<InGuild, GuildMember>;
        }
        return this.guild?.members.resolve(member.user.id) as If<InGuild, GuildMember>;
    }
    public get replied() {
        return this.interaction.replied;
    }
    /**
     * `true` if the interaction was deferred.
     */
    public get deferred() {
        return this.interaction.deferred;
    }
    public readonly interaction: ChatInputCommandInteraction<GuildCacheType<InGuild>>;

    public constructor(interaction: ChatInputCommandInteraction<GuildCacheType<InGuild>>) {
        super();
        this.interaction = interaction;
    }

    public inGuild(): this is SlashCommandContext<true> {
        return this.interaction.inGuild();
    }
    /**
     * Defers the interaction reply.
     * 
     * @param options Defer reply options
     */
    public deferReply(options?: InteractionDeferReplyOptions): Promise<InteractionResponse<BooleanCache<GuildCacheType<InGuild>>>> {
        return this.interaction.deferReply(options);
    }
    public reply(
        options: string | InteractionReplyOptions & InteractionEditReplyOptions | MessagePayload,
        thumbnailKey: string
    ): Promise<InteractionCallbackResponse<InGuild> | Message<InGuild>>;
    public reply(
        options: InteractionReplyOptions & InteractionEditReplyOptions & { withResponse: true },
        thumbnailKey?: string
    ): Promise<InteractionCallbackResponse<InGuild> | Message<InGuild>>;
    public reply(
        options: string | InteractionReplyOptions & InteractionEditReplyOptions | MessagePayload,
        thumbnailKey?: string
    ): Promise<InteractionResponse<BooleanCache<GuildCacheType<InGuild>>> | Message<InGuild>>;
    public async reply(
        options: string | InteractionReplyOptions & InteractionEditReplyOptions | MessagePayload,
        thumbnailKey?: string
    ): Promise<InteractionCallbackResponse<InGuild> | InteractionResponse<BooleanCache<GuildCacheType<InGuild>>> | Message<InGuild>> {
        if (!this.deferred) {
            if (thumbnailKey != null) {
                const response = await this.interaction.reply(
                    (typeof options === 'string'
                        ? { content: options, withResponse: true }
                        : {
                            ...(options instanceof MessagePayload
                                ? options.options as MessageOptions & InteractionReplyOptions & InteractionEditReplyOptions
                                : options),
                            withResponse: true
                        }
                    )
                ) as InteractionCallbackResponse<InGuild>;
                let message;
                if ((message = response.resource?.message)) {
                    cacheMessageThumbnailURL(thumbnailKey, message);
                    return message;
                }
                return response;
            }
            return await this.interaction.reply(options);
        }
        // edit reply when deferred for ease of use
        return this.editReply(options, thumbnailKey);
    }
    public async editReply(options: string | InteractionEditReplyOptions | MessagePayload, thumbnailKey?: string): Promise<Message<InGuild>> {
        const message = await this.interaction.editReply(options);
        if (thumbnailKey != null) {
            cacheMessageThumbnailURL(thumbnailKey, message);
        }
        return message as Message<InGuild>;
    }
    public async followUp(options: string | InteractionReplyOptions | MessagePayload, thumbnailKey?: string): Promise<Message<InGuild>> {
        const message = await this.interaction.followUp(options);
        if (thumbnailKey != null) {
            cacheMessageThumbnailURL(thumbnailKey, message);
        }
        return message as Message<InGuild>;
    }
    public async deleteReply(options?: MessageResolvable): Promise<void> {
        await this.interaction.deleteReply(options);
    }
}

export class MessageCommandContext<InGuild extends boolean = boolean> extends CommandContext<InGuild> {
    private readonly replies: Collection<Snowflake, Message<InGuild>> = new Collection();
    public get client(): Client<true> {
        return this.message.client;
    }
    public readonly commandName: string;
    public get userId(): Snowflake {
        return this.user.id;
    }
    public get channelId(): Snowflake {
        return this.message.channelId;
    }
    public get guildId(): If<InGuild, Snowflake> {
        return this.message.guildId;
    }
    public get user(): User {
        return this.message.author;
    }
    public get channel(): If<InGuild, GuildTextBasedChannel, TextBasedChannel> {
        return this.message.channel;
    }
    public get guild(): If<InGuild, Guild> {
        return this.message.guild;
    }
    public get member(): If<InGuild, GuildMember> {
        return this.message.member as If<InGuild, GuildMember>;
    }
    public get replied(): boolean {
        return this.replies.size > 0;
    }
    public readonly message: Message<InGuild>;
    private readonly content: string;

    public constructor(message: Message<InGuild>, prefix?: string) {
        super();
        const [name, content] = split(message.content, /\s+/g, 2);
        this.message = message;
        this.commandName = name?.substring(prefix?.length ?? 0) ?? '';
        this.content = content ?? '';
    }

    public inGuild(): this is MessageCommandContext<true> {
        return this.message.inGuild();
    }
    public getArguments(count?: number): string[] {
        return split(this.content, /\s+/g, count);
    }
    public async reply(options: string | MessageReplyOptions | MessagePayload, thumbnailKey?: string): Promise<OmitPartialGroupDMChannel<Message<InGuild>>> {
        if (this.replied) {
            throw new Error('The command has already been replied to.');
        }
        if (typeof options === 'string') {
            options = { content: options };
        }
        const replyOptions = options instanceof MessagePayload ? options.options as MessageOptions & MessageReplyOptions : options;
        replyOptions.allowedMentions ??= { repliedUser: false };
        replyOptions.failIfNotExists ??= false;
        const message = await this.message.reply(options);
        this.replies.set(message.id, message);
        if (thumbnailKey != null) {
            cacheMessageThumbnailURL(thumbnailKey, message);
        }
        return message;
    }
    public async editReply(options: string | MessageEditOptions | MessagePayload, thumbnailKey?: string): Promise<OmitPartialGroupDMChannel<Message<InGuild>>> {
        const target = this.replies.last();
        if (!target) {
            throw new Error('The command has not been replied to.');
        }
        const message = await target.edit(options);
        if (thumbnailKey != null) {
            cacheMessageThumbnailURL(thumbnailKey, message);
        }
        return message;
    }
    public async followUp(options: string | MessageReplyOptions | MessagePayload, thumbnailKey?: string): Promise<OmitPartialGroupDMChannel<Message<InGuild>>> {
        const target = this.replies.last();
        if (!target) {
            throw new Error('The command has not been replied to.');
        }
        if (typeof options === 'string') {
            options = { content: options };
        }
        const replyOptions = options instanceof MessagePayload ? options.options as MessageOptions & MessageReplyOptions : options;
        replyOptions.allowedMentions ??= { repliedUser: false };
        replyOptions.failIfNotExists ??= false;
        const message = await target.reply(options);
        if (thumbnailKey != null) {
            cacheMessageThumbnailURL(thumbnailKey, message);
        }
        return message;
    }
    public async deleteReply(options: MessageResolvable | '@original'): Promise<void> {
        const target = options === '@original' ? this.replies.first() : this.replies.get(options instanceof Message ? options.id : options);
        if (!target) {
            throw new Error('The target message does not exist.');
        }
        await target.delete();
    }
}
