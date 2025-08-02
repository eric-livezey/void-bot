import { ChatInputCommandInteraction, Client, Guild, GuildMember, GuildTextBasedChannel, If, InteractionResponse, Message, MessageFlags, MessageFlagsBitField, MessageFlagsResolvable, MessagePayload, MessagePayloadOption, OmitPartialGroupDMChannel, PartialGroupDMChannel, Snowflake, TextBasedChannel, User } from "discord.js";
import { Player } from "./player";
import { TrackerManager } from "./tracker";


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

function makeEphemeral(options: string | MessagePayloadOption): MessagePayloadOption {
    if (typeof options === 'string') {
        return { content: options, flags: MessageFlags.Ephemeral };
    }
    options.flags = new MessageFlagsBitField(options.flags as MessageFlagsResolvable | undefined).add(MessageFlagsBitField.Flags.Ephemeral).bitfield;
    return options;
}

export interface ContextOptions {
    client: Client<true>;
    commandName: string;
    user: User;
    channelId: Snowflake;
    guildId?: Snowflake;
}

/**
 * The context an invoked command.
 */
export abstract class CommandContext<InGuild extends boolean = boolean> {
    /**
     * The client associated with the command.
     */
    public readonly client: Client<true>;
    /**
     * The name of the command.
     */
    public readonly commandName: string;
    /**
     * The user which invoked the command.
     */
    public readonly user: User;
    /**
     * The ID of the channel the command was invoked in.
     */
    public readonly channelId: Snowflake;
    /**
     * The channel the command was invoked in.
     */
    public get channel(): Exclude<If<InGuild, GuildTextBasedChannel, TextBasedChannel>, PartialGroupDMChannel> {
        return this.client.channels.resolve(this.channelId) as Exclude<If<InGuild, GuildTextBasedChannel, TextBasedChannel>, PartialGroupDMChannel>;
    }
    /**
     * If applicable, the ID of the guild in which the command was invoked in.
     */
    public readonly guildId: If<InGuild, Snowflake>;
    /**
     * If applicable, the guild in which the command was invoked in.
     */
    public get guild(): If<InGuild, Guild> {
        return (this.inGuild() ? this.client.guilds.resolve(this.guildId) : null) as If<InGuild, Guild>;
    }
    /**
     * If applicable, the guild member which invoked the command.
     */
    public get member(): If<InGuild, GuildMember> {
        return (this.inGuild() ? this.guild.members.resolve(this.user.id) : null) as If<InGuild, GuildMember>;
    }
    public abstract get replied(): boolean;
    public get repliable() {
        return !this.replied;
    };
    public get player(): If<InGuild, Player> {
        return (this.inGuild() ? Player.of(this.guildId) : null) as If<InGuild, Player>;
    }
    public get trackers(): TrackerManager {
        return TrackerManager.of(this.client);
    }

    /**
     * Creates a new context with the specific options.
     * 
     * @param options Options.
     */
    public constructor(options: ContextOptions) {
        this.client = options.client;
        this.commandName = options.commandName;
        this.user = options.user;
        this.channelId = options.channelId;
        this.guildId = (options.guildId ?? null) as If<InGuild, Snowflake>;
    }

    /**
     * Returns `true` if the command was invoked in a guild, else `false`.
     */
    public inGuild(): this is CommandContext<true> {
        return this.guildId !== null;
    }
    /**
     * Returns `true` if the command is a message command, else `false`.
     */
    public isMessage(): this is MessageContext<InGuild> {
        return this instanceof MessageContext;
    }
    /**
     * Returns `true` if the command is an interaction command, else `false`.
     */
    public isInteraction(): this is InteractionContext<InGuild> {
        return this instanceof InteractionContext;
    }
    /**
     * Reply to the command.
     */
    public abstract reply(options: string | MessagePayloadOption, ephemeral?: boolean): Promise<any>;
    /**
     * Create a follow up reply to the command.
     */
    public abstract followUp(options: string | MessagePayloadOption, ephemeral?: boolean): Promise<any>;
    /**
     * Edit the existing reply to the command.
     */
    public abstract editReply(options: string | MessagePayloadOption): Promise<any>;
    /**
     * Reply to the command, or create a follow up message if the command has already been replied to.
     */
    public replyOrFollowUp(options: string | MessagePayloadOption, ephemeral?: boolean) {
        return this.repliable ? this.reply(options, ephemeral) : this.followUp(options, ephemeral);
    }
    /**
     * Reply to the command, or edit the reply if the command has already been replied to.
     */
    public replyOrEditReply(options: string | MessagePayloadOption, ephemeral?: boolean) {
        return this.repliable ? this.reply(options, ephemeral) : this.editReply(options);
    }
    protected resolveMessagePayload(options: string | MessagePayloadOption) {
        return typeof options === 'string' ? options : MessagePayload.create(this.channel, options);
    }
}

/**
 * The context of a command which was invoked via a message.
 */
export class MessageContext<InGuild extends boolean = boolean> extends CommandContext<InGuild> {
    private readonly content: string;
    private response: Message<InGuild> | null = null;
    /**
     * The message which invoked the command.
     */
    public readonly message: OmitPartialGroupDMChannel<Message<InGuild>>;
    public get replied() {
        return this.response != null;
    }

    public constructor(message: OmitPartialGroupDMChannel<Message<InGuild>>, prefix: string) {
        const [name, content] = split(message.content, /\s+/g, 2);
        super({
            client: message.client,
            commandName: name?.substring(prefix.length) ?? "",
            user: message.author,
            channelId: message.channelId,
            guildId: message.guildId ?? undefined
        });
        this.message = message;
        this.content = content ?? "";
    }

    /**
     * Returns the parsed arguments for the command.
     * 
     * @param limit The maximum number of arguments.
     */
    public getArguments(limit?: number): string[] {
        return split(this.content, /\s+/g, limit);
    }
    public async reply(options: string | MessagePayloadOption): Promise<Message<InGuild>> {
        const payload = this.resolveMessagePayload(options);
        return this.response = await this.channel.send(payload) as Message<InGuild>;
    }
    public async followUp(options: string | MessagePayloadOption): Promise<Message<InGuild>> {
        return this.response = await this.reply(options);
    }
    public async editReply(options: string | MessagePayloadOption): Promise<Message<InGuild>> {
        const payload = this.resolveMessagePayload(options);
        throw this.response = await this.response!.edit(payload);
    }
}

/**
 * The context of a command invoked via a {@link ChatInputCommandInteraction}.
 */
export class InteractionContext<InGuild extends boolean = boolean> extends CommandContext<InGuild> {
    public readonly interaction: ChatInputCommandInteraction;
    public get deferred() {
        return this.interaction.deferred;
    }
    public get replied() {
        return this.interaction.replied;
    }

    constructor(interaction: ChatInputCommandInteraction) {
        super({
            client: interaction.client,
            user: interaction.user,
            channelId: interaction.channelId,
            guildId: interaction.guildId ?? undefined,
            commandName: interaction.commandName
        });
        this.interaction = interaction;
    }

    /**
     * Defer the interaction reply.
     */
    public async deferReply(): Promise<void> {
        if (!this.deferred) {
            await this.interaction.deferReply();
        }
    }
    public async reply(options: string | MessagePayloadOption, ephemeral?: boolean): Promise<InteractionResponse | Message<InGuild>> {
        if (this.deferred) {
            return this.editReply(options);
        }
        if (ephemeral) {
            options = makeEphemeral(options);
        }
        const payload = this.resolveMessagePayload(options);
        return await this.interaction.reply(payload);
    }
    public async followUp(options: string | MessagePayloadOption, ephemeral?: boolean): Promise<Message<InGuild>> {
        if (ephemeral) {
            options = makeEphemeral(options);
        }
        const payload = this.resolveMessagePayload(options);
        return await this.interaction.followUp(payload) as Message<InGuild>;
    }
    public async editReply(options: string | MessagePayloadOption): Promise<Message<InGuild>> {
        const payload = this.resolveMessagePayload(options);
        return await this.interaction.editReply(payload) as Message<InGuild>;
    }
}
