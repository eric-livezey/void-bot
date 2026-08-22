import { AutocompleteInteraction, ChatInputCommandInteraction, Collection, Message, MessageFlags, REST, Routes, type RESTPostAPIChatInputApplicationCommandsJSONBody, type RESTPutAPIApplicationCommandsResult, type RESTPutAPIApplicationGuildCommandsResult, type Snowflake } from "discord.js";
import type { SlashCommand } from "./command.js";
import { MessageCommandContext, SlashCommandContext, type GuildCacheType } from "./commandContext.js";
import type { MessageCommand } from "./command.js";

/**
 * A manager for commands.
 */
export abstract class CommandManager<T> {
    /**
     * A collection of commands by name.
     */
    protected readonly commands: Collection<string, T>;

    constructor() {
        this.commands = new Collection();
    }

    public has(commandName: string): boolean {
        return this.commands.has(commandName);
    }

    public get(commandName: string): T | undefined {
        return this.commands.get(commandName);
    }

    public abstract register(command: T): void;
}
type AnySlashCommand = SlashCommand<true> | SlashCommand<false>;
/**
 * Options for registering a command to a client.
 */
export interface SlashCommandInstallOptions {
    /**
     * IDs of guilds in which the command should be installed.
     */
    guildIds?: readonly Snowflake[];
    /**
     * If `false`, the command will not be installed globally.
     */
    global?: boolean;
}
const DEFAULT_SLASH_COMMAND_INSTALL_OPTIONS = Object.freeze({
    guildIds: Object.freeze([]),
    global: true
}) satisfies SlashCommandInstallOptions;
/**
 * A manager for slash commands.
 */
export class SlashCommandManager extends CommandManager<AnySlashCommand> {
    private readonly installOptions: Collection<string, { readonly guildIds: readonly Snowflake[]; readonly global: boolean; }>;

    public constructor() {
        super();
        this.installOptions = new Collection();
    }
    /**
     * Responds to a command interaction with the relevant command if it exists.
     * 
     * @param interaction A chat input command interaction
     */
    public async handleCommandInteraction<InGuild extends boolean>(interaction: ChatInputCommandInteraction<GuildCacheType<InGuild>>): Promise<void> {
        const ctx = new SlashCommandContext(interaction);
        const command = this.get(interaction.commandName) as SlashCommand<InGuild>;

        if (!command) {
            // command does not exist
            console.error(`No command matching ${ctx.commandName} was found.`);
            return;
        }

        try {
            // execute command
            await command.execute(ctx);
        } catch (error) {
            // handle errors
            console.error(error);
            try {
                await ctx.replyOrFollowUp({ content: 'An unexpected error occurred while executing the command.', flags: MessageFlags.Ephemeral });
            } catch (e) {
                console.error(e);
            }
        }
    }

    /**
     * Responds to an autocomplete interaction with the relevant command's autocomplete callback if
     * it exists.
     * 
     * @param interaction An autocomplete interaction
     */
    public async handleAutocompleteInteraction(interaction: AutocompleteInteraction): Promise<void> {
        const command = this.commands.get(interaction.commandName);

        if (!command) {
            console.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        if (!command.autocomplete) {
            console.error("The matching command does not an 'autocomplete' method");
            return;
        }

        try {
            await command.autocomplete(interaction);
        } catch (error) {
            console.error(error);
        }
    }

    /**
     * Installs all commands held by the manager.
     * 
     * @param token The bot's token.
     * @param clientId The bot's client ID.
     */
    public async installCommands(token: string, clientId: Snowflake) {
        const globalCommands: RESTPostAPIChatInputApplicationCommandsJSONBody[] = [];
        const guildCommands = new Collection<Snowflake, RESTPostAPIChatInputApplicationCommandsJSONBody[]>();

        for (const command of this.commands.values()) {
            const data = command.data.toJSON();
            const { global, guildIds } = this.installOptions.get(command.data.name) ?? DEFAULT_SLASH_COMMAND_INSTALL_OPTIONS;
            if (global) {
                globalCommands.push(data);
            }
            for (const guildId of guildIds) {
                let commands = guildCommands.get(guildId);
                if (!commands) {
                    guildCommands.set(guildId, commands = []);
                }
                commands.push(data);
            }
        }

        const rest = new REST().setToken(token);

        let total = globalCommands.length + guildCommands.reduce((acc, v) => acc + v.length, 0);
        console.log(`Started refreshing ${total} application (/) commands.`);
        try {
            const data = await rest.put(
                Routes.applicationCommands(clientId),
                { body: globalCommands }
            ) as RESTPutAPIApplicationCommandsResult;
            total = data.length;

            for (const [guildId, commands] of guildCommands) {
                const guildData = await rest.put(
                    Routes.applicationGuildCommands(clientId, guildId),
                    { body: commands }
                ) as RESTPutAPIApplicationGuildCommandsResult;
                total += guildData.length;
            }

            console.log(`Successfully reloaded ${total} application (/) commands.`);
        } catch (error) {
            console.error(error);
        }
    }

    /**
     * Registers a command with the manager.
     * 
     * @param command A slash command.
     * @param options Installation options.
     */
    public register(command: AnySlashCommand, options?: SlashCommandInstallOptions): void {
        this.commands.set(
            command.data.name,
            command
        );
        if (options) {
            this.installOptions.set(command.data.name, { guildIds: options.guildIds ?? [], global: options.global !== false });
        }
    }
}
type AnyMessageCommand = MessageCommand<true> | MessageCommand<false>;
/**
 * A manager for message commands.
 */
export class MessageCommandManager extends CommandManager<AnyMessageCommand> {
    /**
     * Prefix which identifies message commands.
     */
    public readonly prefix: string;
    // list of unique commands
    private readonly commandsList: (AnyMessageCommand)[];

    /**
     * Constructs a new empty {@link MessageCommandManager}.
     */
    constructor(prefix: string) {
        super();
        this.prefix = prefix;
        this.commandsList = [];
    }

    /**
     * Handles an incoming message. If the message is a command, it will respond accordingly.
     * 
     * @param message A discord message.
     */
    public async handleMessage<InGuild extends boolean>(message: Message<InGuild>): Promise<void> {
        if (!message.content.startsWith(this.prefix)) {
            return;
        }
        const ctx = new MessageCommandContext(message, this.prefix);
        const command = this.commands.get(ctx.commandName.toLowerCase());

        if (!command) {
            // command does not exist
            await ctx.reply(`\`${this.prefix}${ctx.commandName}\` is not a valid command.`);
            return;
        }

        if ((command.dmPermission || command.memberPermissions != null) && ctx.channel.isDMBased()) {
            // attempt to use DM restricted command in a DM
            await ctx.reply(`This command is not available in DMs.`);
            return;
        }

        if (command.memberPermissions && ctx.inGuild() && !ctx.member.permissions.has(command.memberPermissions)) {
            // insufficient permissions
            await ctx.reply('You do not have sufficient permissions to execute this command.');
            return;
        }

        if (command.ownerOnly && !ctx.isOwner()) {
            // command is owner only but the user is not the owner, so silently ignore
            return;
        }

        try {
            // execute command
            await (command as MessageCommand<InGuild>).execute(ctx);
        } catch (error) {
            // handle errors
            console.error(error);
            try {
                await ctx.replyOrFollowUp('An unexpected error occurred while executing the command.');
            } catch (e) {
                console.error(e);
            }
        }
    }

    /**
     * Registers a command with the manager.
     * 
     * @param command A slash command.
     * @param options Installation options.
     */
    public register(command: AnyMessageCommand): void {
        this.commandsList.push(command);
        for (const alias of command.aliases) {
            this.commands.set(
                alias,
                command
            );
        }
    }
}
export interface CommandManagers {
    readonly slashCommands: SlashCommandManager;
    readonly messageCommands: MessageCommandManager | null;
}
