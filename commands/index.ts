import { AutocompleteInteraction, Client as BaseClient, type ClientOptions, Collection, type PermissionResolvable, SlashCommandBuilder, type SlashCommandOptionsOnlyBuilder, type SlashCommandSubcommandsOnlyBuilder } from 'discord.js';
import { MessageCommandContext, SlashCommandContext } from '../context.js';

export interface Command<InGuild extends boolean = boolean> {
    interaction?: InteractionCommand<InGuild>;
    message?: MessageCommand<InGuild>[];
}

export interface InteractionCommand<InGuild extends boolean = boolean> {
    data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
    isGuildCommand?: boolean;
    execute: (ctx: SlashCommandContext<InGuild>) => Promise<void>;
    autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

export interface MessageCommand<InGuild extends boolean = boolean> {
    aliases: string[];
    requiredPermissions?: PermissionResolvable;
    isDmRestricted?: boolean;
    isOwnerOnly?: boolean;
    execute: (ctx: MessageCommandContext<InGuild>) => Promise<void>;
}

/**
 * Client with commands.
 */
export class Client<Ready extends boolean> extends BaseClient<Ready> {
    public readonly commands: Collection<string, InteractionCommand>;
    public readonly messageCommands: Collection<string, MessageCommand>;

    constructor(options: ClientOptions, commands: Collection<string, InteractionCommand>, messageCommands: Collection<string, MessageCommand>) {
        super(options);
        this.commands = commands;
        this.messageCommands = messageCommands;
    }
}
