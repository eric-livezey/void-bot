import { REST, type RESTPutAPIApplicationCommandsResult, type RESTPutAPIApplicationGuildCommandsResult, Routes } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Command } from '../commands/index.js';
import config from '../config.json' with { type: 'json' };
import type { ConfigOptions } from '../utils.js';

const { token, clientId, guildId } = config as ConfigOptions;
const isTokenSet = token != null;
const isClientIdSet = clientId != null;
const isGuildIdSet = guildId != null;

if (!isTokenSet || !isClientIdSet) {
    if (!isTokenSet) {
        console.error('[ERROR]', "'token' is not set.");
    }
    if (!isClientIdSet) {
        console.error('[ERROR]', "'clientId' is not set.");
    }
    process.exit(1);
}

const commands = [];
const guildCommands = [];
const foldersPath = path.relative('.', path.join(import.meta.dirname, '..', 'commands'));
const commandFolders = fs.readdirSync(foldersPath);

(async () => {
    for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        const commandsStat = fs.statSync(commandsPath);
        if (commandsStat.isDirectory()) {
            const commandFiles = fs.readdirSync(commandsPath);
            for (const file of commandFiles) {
                const filePath = path.join(commandsPath, file);
                const fileStat = fs.statSync(filePath);
                if (fileStat.isFile() && path.extname(file) === '.js') {
                    const filePath = path.join(commandsPath, file);
                    const module = await import(pathToFileURL(filePath).href);
                    const command = module.default as Command | undefined;
                    if (command != null) {
                        if (command.interaction) {
                            const interaction = command.interaction;
                            if ('data' in interaction && 'execute' in interaction) {
                                if (interaction.isGuildCommand) {
                                    guildCommands.push(interaction.data.toJSON());
                                } else {
                                    commands.push(interaction.data.toJSON());
                                }
                            } else {
                                console.log(`[WARNING] The command at ${filePath} is missing a required 'interaction.data' or 'interaction.execute' property.`);
                            }
                        }
                    } else {
                        console.warn(`[WARNING] The command at ${filePath} does not have a default export.`);
                    }
                }
            }
        }
    }

    const rest = new REST().setToken(token);

    try {
        let total = commands.length + guildCommands.length;
        console.log(`Started refreshing ${total} application (/) commands.`);

        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands }
        ) as RESTPutAPIApplicationCommandsResult;
        total = data.length;

        if (isGuildIdSet) {
            const guildData = await rest.put(
                Routes.applicationGuildCommands(clientId, guildId),
                { body: guildCommands }
            ) as RESTPutAPIApplicationGuildCommandsResult;
            total += guildData.length;
        }

        console.log(`Successfully reloaded ${total} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();
