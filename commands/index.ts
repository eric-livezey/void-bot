import { Client as BaseClient, ClientOptions, Collection, PermissionsBitField, SlashCommandBuilder, SlashCommandOptionsOnlyBuilder, SlashCommandSubcommandsOnlyBuilder } from "discord.js";
import { InteractionContext, MessageContext } from "../context";

export interface Command {
    interaction?: InteractionCommand;
    message?: MessageCommand[];
}

export interface InteractionCommand {
    data: SlashCommandBuilder | SlashCommandOptionsOnlyBuilder | SlashCommandSubcommandsOnlyBuilder;
    isGuildCommand?: boolean;
    execute: (ctx: InteractionContext) => Promise<void>;
}

export interface MessageCommand {
    aliases: string[];
    requiredPermissions?: PermissionsBitField;
    isDmRestricted?: boolean;
    isOwnerOnly?: boolean;
    execute: (ctx: MessageContext) => Promise<void>;
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
