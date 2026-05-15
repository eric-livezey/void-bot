import { Client as BaseClient, ClientOptions, Collection, PermissionsBitField, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder } from 'discord.js';
import { InteractionContext, MessageContext } from '../context';

export interface Command<InGuild extends boolean = boolean> {
    interaction?: InteractionCommand<InGuild>;
    message?: MessageCommand<InGuild>[];
}

export interface InteractionCommand<InGuild extends boolean = boolean> {
    data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
    isGuildCommand?: boolean;
    execute: (ctx: InteractionContext<InGuild>) => Promise<void>;
}

export interface MessageCommand<InGuild extends boolean = boolean> {
    aliases: string[];
    requiredPermissions?: PermissionsBitField;
    isDmRestricted?: boolean;
    isOwnerOnly?: boolean;
    execute: (ctx: MessageContext<InGuild>) => Promise<void>;
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
