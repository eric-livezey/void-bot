import { REST, RESTPutAPIApplicationCommandsResult, RESTPutAPIApplicationGuildCommandsResult, Routes } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { clientId, guildId, token } from '../config.json';
import { Command } from '../commands';

const commands = [];
const guildCommands = [];
const foldersPath = path.join(__dirname, '../commands');
const commandFolders = fs.readdirSync(foldersPath);

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
                const command = require(filePath).default as Command | undefined;
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

(async () => {
    try {
        console.log(`Started refreshing ${commands.length + guildCommands.length} application (/) commands.`);

        const data = await rest.put(
            Routes.applicationCommands(clientId),
            { body: commands }
        ) as RESTPutAPIApplicationCommandsResult;

        const guildData = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: guildCommands }
        ) as RESTPutAPIApplicationGuildCommandsResult;

        console.log(`Successfully reloaded ${data.length + guildData.length} application (/) commands.`);
    } catch (error) {
        console.error(error);
    }
})();
