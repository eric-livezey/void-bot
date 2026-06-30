import { AllowedMentionsTypes, Collection, Events, IntentsBitField, Message, type MessageCreateOptions, MessageFlags, type MessageMentionOptions, MessageMentions, MessagePayload, Partials, Poll, type PollData, userMention } from 'discord.js';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Client, type Command, type InteractionCommand, type MessageCommand } from './commands/index.js';
import { generateGuildsListMessage } from './commands/miscellaneous/guilds.js';
import { generateQueueMessage } from './commands/playback/queue.js';
import config from './config.json' with { type: 'json' };
import { MessageCommandContext, SlashCommandContext } from './context.js';
import { Player } from './player.js';
import { TrackerManager } from './tracker.js';
import { type ConfigOptions, createVoiceConnection } from './utils.js';

/**
 * Client gateway intents.
 */
const INTENTS = new IntentsBitField([
    IntentsBitField.Flags.Guilds,
    IntentsBitField.Flags.GuildVoiceStates,
    IntentsBitField.Flags.GuildPresences,
    IntentsBitField.Flags.GuildMessages,
    IntentsBitField.Flags.DirectMessages,
    IntentsBitField.Flags.MessageContent,
    IntentsBitField.Flags.DirectMessagePolls
]).freeze();

/**
 * Client partials.
 */
const PARTIALS = [Partials.Channel];

function _messageMentionsToOptions(mentions: MessageMentions): MessageMentionOptions {
    return {
        roles: mentions.roles.map(role => role.id),
        users: mentions.users.map(user => user.id),
        repliedUser: !!mentions.repliedUser
    }
}

function _pollToOptions(poll: Poll): PollData {
    return {
        question: poll.question,
        answers: poll.answers.map(answer => ({
            text: answer.text ?? '',
            emoji: answer.emoji?.identifier ?? undefined
        })),
        duration: poll.expiresTimestamp ? Math.ceil((poll.expiresTimestamp - Date.now()) / 3.6e+6) : 24,
        allowMultiselect: poll.allowMultiselect,
        layoutType: poll.layoutType
    }
}

function _messageToCreateOptions(message: Message): MessageCreateOptions {
    return {
        content: message.content ?? undefined,
        embeds: message.embeds.map(embed => embed.toJSON()),
        allowedMentions: _messageMentionsToOptions(message.mentions),
        files: message.attachments.map(attachment => attachment.url),
        components: message.components.map(component => component.toJSON()),
        poll: message.poll ? _pollToOptions(message.poll) : undefined,
        tts: message.tts,
        stickers: message.stickers.toJSON(),
        flags: message.flags.bitfield & (MessageFlags.SuppressEmbeds | MessageFlags.SuppressNotifications | MessageFlags.IsComponentsV2)
    }
}

// add date and time to logs
const log = console.log;
console.log = function (...data) { log(`[${new Date().toLocaleString()}]`, ...data) };

// config
const { token, prefix, dmChannelId } = config as ConfigOptions;
const isTokenSet = token != null;
const isPrefixSet = prefix != null;
const isDmChannelIdSet = dmChannelId != null;

if (!isTokenSet) {
    console.error('[ERROR]', "'token' is not set.");
    process.exit(1);
}

// read commands
const commands = new Collection<string, InteractionCommand>();
const messageCommands = new Collection<string, MessageCommand>();
const foldersPath = path.join(path.relative('.', import.meta.dirname), 'commands');
const commandFolders = readdirSync(foldersPath);

(async () => {
    // iterate through command folders
    for (const folder of commandFolders) {
        const commandsPath = path.join(foldersPath, folder);
        const commandsStat = statSync(commandsPath);
        // only observe directories
        if (commandsStat.isDirectory()) {
            const commandFiles = readdirSync(commandsPath);
            // iterate through command files
            for (const file of commandFiles) {
                const filePath = path.join(commandsPath, file);
                const fileStat = statSync(filePath);
                // only read .js files
                if (fileStat.isFile() && path.extname(file) === '.js') {
                    // import command
                    const module = await import(pathToFileURL(filePath).href);
                    const command = module.default as Command || undefined;
                    // if the command provides a default export
                    if (command != null) {
                        // if the command provides an interaction
                        if (command.interaction) {
                            const interaction = command.interaction;
                            // ensure required keys are present
                            if ('data' in interaction && 'execute' in interaction) {
                                // add the command to the map
                                commands.set(interaction.data.name, interaction);
                            } else {
                                console.warn(`[WARNING] The command at ${filePath} is missing a required 'interaction.data' or 'interaction.execute' property.`);
                            }
                        }
                        // iterate through each message command if any
                        const messages = command.message ?? [];
                        for (const message of messages) {
                            // ensure required keys are present
                            if ('aliases' in message && 'execute' in message) {
                                for (const alias of message.aliases) {
                                    // add the command to the map
                                    messageCommands.set(alias.toLowerCase(), message);
                                }
                            } else {
                                console.warn(`[WARNING] The command at ${filePath} is missing a required 'messages[number].aliases' or 'messages[number].execute' property.`);
                            }
                        }
                    } else {
                        console.warn(`[WARNING] The command at ${filePath} does not have a default export.`);
                    }
                }
            }
        }
    }

    // create the client
    const client = new Client({ intents: INTENTS, partials: PARTIALS }, commands, messageCommands);

    // when the bot is ready
    client.on(Events.ClientReady, async client => {
        console.log(`Logged in as ${client.user.username}.`);
        // start tracking updates
        TrackerManager.of(client).start();
        // re-establish connections to all voice states
        for (const guild of client.guilds.cache.values()) {
            const { voice: { channel } } = await guild.members.fetchMe();
            if (channel) {
                createVoiceConnection(channel);
            }
        }
    });

    // when a message is created
    client.on(Events.MessageCreate, async message => {
        const { channel } = message;
        // ignore messages from the bot user
        if (message.author.id !== message.client.user?.id) {
            // DMs
            if (isDmChannelIdSet && channel.isDMBased()) {
                // forward DMs to the DM channel if present
                const dmChannel = message.client.channels.resolve(dmChannelId);
                if (dmChannel?.isSendable()) {
                    await dmChannel.send({
                        content: `**From ${userMention(channel.recipientId)}**:`,
                        allowedMentions: { parse: [AllowedMentionsTypes.User] }
                    });
                    await dmChannel.send(_messageToCreateOptions(message));
                }
            }
            // commands
            if (isPrefixSet && message.content.startsWith(prefix)) {
                // create context
                const ctx = new MessageCommandContext(message, prefix);
                // find command
                const command = client.messageCommands.get(ctx.commandName.toLowerCase());

                // invalid command
                if (!command) {
                    await ctx.reply(`\`${prefix}${ctx.commandName}\` is not a valid command.`);
                    return;
                }

                // attempt to use DM restricted command in a DM
                if ((command.isDmRestricted || command.requiredPermissions != null) && ctx.channel.isDMBased()) {
                    await ctx.reply(`This command is not available in DMs.`);
                    return;
                }

                // insufficient permissions
                if (command.requiredPermissions && ctx.inGuild() && !ctx.member.permissions.has(command.requiredPermissions)) {
                    await ctx.reply('You do not have sufficient permissions to execute this command.');
                    return;
                }

                // silently ignore if owner only
                if (command.isOwnerOnly && !ctx.isOwner()) {
                    return;
                }

                try {
                    // execute command
                    await command.execute(ctx);
                } catch (error) {
                    // handle errors
                    console.error(error);
                    try {
                        await ctx.replyOrFollowUp('There was an error while executing this command.');
                    } catch (e) {
                        console.error(e);
                    }
                }
            }
        }
    });

    // when an interaction is created
    client.on(Events.InteractionCreate, async interaction => {
        if (interaction.isChatInputCommand()) {  // commands
            // create context
            const ctx = new SlashCommandContext(interaction);
            // find command
            const command = client.commands.get(ctx.commandName);

            // invalid command
            if (!command) {
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
                    await ctx.replyOrFollowUp({ content: 'There was an error while executing this command.', flags: MessageFlags.Ephemeral });
                } catch (e) {
                    console.error(e);
                }
            }
        } else if (interaction.isMessageComponent()) { // components
            const { customId, channel } = interaction;
            // resolve parameters from custom ID
            const [type, argument] = customId.split(':');
            try {
                switch (type) {
                    case 'QUEUE_PAGE':
                        // queue page update
                        if (channel?.isTextBased() && interaction.inGuild()) {
                            await interaction.update(MessagePayload.create(channel, generateQueueMessage(Player.of(interaction.guildId), Number(argument))));
                        }
                        break;
                    case 'GUILDS_LIST_PAGE':
                        if (channel?.isTextBased) {
                            await interaction.update(MessagePayload.create(channel, generateGuildsListMessage(interaction.client.guilds.cache, Number(argument))));
                        }
                        break;
                }
            } catch (e) {
                console.error(e);
            }
        } else if (interaction.isAutocomplete()) { // autocomplete
            const command = client.commands.get(interaction.commandName);

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
    });

    client.login(token);
})();
