import type { AutocompleteInteraction, If, PermissionResolvable, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder } from "discord.js";
import type { CommandContext, MessageCommandContext, SlashCommandContext } from "./commandContext.js";

/**
 * A function which can be called with the context of a command to execute it.
 */
export type CommandCallback<InGuild extends boolean = boolean, Context extends CommandContext<InGuild> = CommandContext<InGuild>> = {
    /**
     * @param context The context of the executed command.
     */
    (context: Context): Promise<unknown>
};
/**
 * Represents a command which can be executed by the bot.
 */
export interface Command<InGuild extends boolean = boolean, Context extends CommandContext<InGuild> = CommandContext<InGuild>> {
    /**
     * A function which is called each time the command is executed.
     */
    readonly execute: CommandCallback<InGuild, Context>;
}
/**
 * Slash command data.
 */
export type SlashCommandData = SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
/**
 * A function which responds to a slash command.
 */
export type SlashCommandCallback<InGuild extends boolean> = CommandCallback<InGuild, SlashCommandContext<InGuild>>;
/**
 * A function which responds to an autocomplete interaction.
 */
export type AutocompleteCallback = {
    /**
     * @param interaction An autocomplete interaction.
     */
    (interaction: AutocompleteInteraction): Promise<unknown>;
}
/**
 * Options for constructing a new slash command.
 */
export interface SlashCommandOptions<InGuild extends boolean> {
    /**
     * Slash command data.
     */
    data: SlashCommandData;
    /**
     * A function which is called each time the command is executed.
     */
    execute: SlashCommandCallback<InGuild>;
    /**
     * A function which is called each time a relevant autocomplete interaction is received.
     */
    autocomplete?: AutocompleteCallback | undefined;
}
/**
 * Represents a command which can be invoked via a slash command interaction.
 * 
 * @template InGuild `true` if the command can be only executed in guilds.
 */
export class SlashCommand<InGuild extends boolean = boolean> implements Command<InGuild, SlashCommandContext<InGuild>> {
    /**
     * Slash command data.
     */
    public readonly data: SlashCommandData;
    /**
     * A function which is called each time the command is executed.
     */
    public readonly execute: SlashCommandCallback<InGuild>;
    /**
     * A function which is called each time a relevant autocomplete interaction is received.
     */
    public readonly autocomplete: AutocompleteCallback | null;
    /**
     * Constructs a new slash command with the specified options.
     * 
     * @param options Slash command options.
     */
    public constructor({ data, execute, autocomplete }: SlashCommandOptions<InGuild>) {
        this.data = data;
        this.execute = execute;
        this.autocomplete = autocomplete ?? null;
    }
}
/**
 * A function which responds to a message command.
 */
export type MessageCommandCallback<InGuild extends boolean> = CommandCallback<InGuild, MessageCommandContext<InGuild>>;
/**
 * Options for constructing a new message command.
 */
export type MessageCommandOptions<InGuild extends boolean> = {
    /**
     * A list of aliases which can be used to execute the command. You should specify at least one
     * alias when creating a command.
     */
    aliases: readonly string[];
    /**
     * A callback which is called each time the command is executed.
     */
    execute: MessageCommandCallback<InGuild>;
    /**
     * Permissions which a user must have before the command can be executed.
     */
    memberPermissions?: If<InGuild, PermissionResolvable | undefined, undefined>;
} & If<InGuild, {
    /**
     * `false` if the command should not be allowed in DMs.
     * 
     * @default true
     */
    dmPermission?: boolean | undefined;
}, {
    /**
     * `false` if the command should not be allowed in DMs.
     * 
     * @default true
     */
    dmPermission: false;
}> & {
    /**
     * `true` if only the bot owner should be able to execute the command.
     * 
     * @default false
     */
    ownerOnly?: boolean | undefined;
    /**
     * Arguments to display with the help command.
     */
    arguments?: readonly MessageCommandArgumentOptions[] | undefined;
    /**
     * A description of the command to show with the help command.
     */
    description?: string | undefined;
}
/**
 * Represents options for an argument for a message command.
 */
export interface MessageCommandArgumentOptions {
    /**
     * The name of the command.
     */
    name: string;
    /**
     * `true` if the argument is optional.
     * 
     * @default false
     */
    optional?: boolean;
}
/**
 * Represents an argument for a message command.
 */
export interface MessageCommandArgument {
    /**
     * The name of the command.
     */
    readonly name: string;
    /**
     * `true` if the argument is optional, else `false`.
     */
    readonly optional: boolean;
}
/**
 * Represents a command invoked via a message.
 * 
 * @template InGuild `true` if the command can be only executed in guilds
 */
export class MessageCommand<InGuild extends boolean = boolean> implements Command<InGuild, MessageCommandContext<InGuild>> {
    /**
     * A list of aliases which can be used to execute the command.
     */
    public readonly aliases: readonly string[];
    /**
     * A callback which is called each time the command is executed.
     */
    public readonly execute: MessageCommandCallback<InGuild>;
    /**
     * Permissions which a user must have before the command can be executed.
     * 
     * @default null
     */
    public readonly memberPermissions: If<InGuild, PermissionResolvable | null>;
    /**
     * `true` if the command should be allowed in DMs, else `false`.
     * 
     * @default true
     */
    public readonly dmPermission: If<InGuild, false, true>;
    /**
     * `true` if only the bot owner should be able to execute the command, else `false`.
     * 
     * @default false
     */
    public readonly ownerOnly: boolean;
    /**
     * Arguments to display with the help command.
     */
    public readonly arguments: readonly MessageCommandArgument[];
    /**
     * A description of the command to show with the help command.
     * 
     * @default null
     */
    public readonly description: string | null;
    /**
     * Constructs a new message command with the specified options.
     * 
     * @param options Message command options.
     */
    public constructor({ aliases, execute, memberPermissions, dmPermission, ownerOnly, arguments: args, description }: MessageCommandOptions<InGuild>) {
        this.aliases = aliases;
        this.execute = execute;
        this.memberPermissions = (memberPermissions ?? null) as If<InGuild, PermissionResolvable | null, null>;
        this.dmPermission = (dmPermission ?? true) as If<InGuild, false, true>;
        this.ownerOnly = ownerOnly ?? false;
        this.arguments = args?.map(({ name, optional }) => ({ name, optional: optional ?? false })) ?? [];
        this.description = description ?? null;
    }
}