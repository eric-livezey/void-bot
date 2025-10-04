import { AllowedMentionsTypes, Collection, Events, IntentsBitField, Message, MessageCreateOptions, MessageFlags, MessageMentionOptions, MessageMentions, MessagePayload, Partials, Poll, PollData, userMention } from 'discord.js';
import { readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { Client, Command, InteractionCommand, MessageCommand } from './commands';
import { generateQueueMessage } from './commands/playback/queue';
import { dmChannelId, ownerId, token, prefix } from './config.json';
import { InteractionContext, MessageContext } from './context';
import { Player } from './player';
import { TrackerManager } from './tracker';
import { createVoiceConnection } from './utils';

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
    IntentsBitField.Flags.DirectMessagePolls,
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
        duration: Math.ceil((poll.expiresTimestamp - Date.now()) / 3.6e+6),
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

// Add date and time to logs
const log = console.log;
console.log = function (...data) { log(`[${new Date().toLocaleString()}]`, ...data) };

// read commands
const commands = new Collection<string, InteractionCommand>();
const messageCommands = new Collection<string, MessageCommand>();
const foldersPath = path.join(__dirname, 'commands');
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
                    const module = await import(filePath);
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
                                    messageCommands.set(alias, message);
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
            if (channel.isDMBased()) {
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
            if (message.content.startsWith(prefix)) {
                // create context
                const ctx = new MessageContext(message, prefix);
                // find command
                const command = client.messageCommands.get(ctx.commandName);

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
                if (command.requiredPermissions && !ctx.member!.permissions.has(command.requiredPermissions)) {
                    await ctx.reply('You do not have sufficient permissions to execute this command.');
                    return;
                }

                // silently ignore if owner only
                if (command.isOwnerOnly && ctx.user.id !== ownerId) {
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
        // commands
        if (interaction.isChatInputCommand()) {
            // create context
            const ctx = new InteractionContext(interaction);
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
        }
        // components
        if (interaction.isMessageComponent()) {
            const { customId, channel } = interaction;
            // resolve parameters from custom ID
            const [type, argument] = customId.split(':');
            switch (type) {
                case 'QUEUE_PAGE':
                    // queue page update
                    if (channel?.isTextBased() && interaction.inGuild()) {
                        await interaction.update(MessagePayload.create(channel, generateQueueMessage(Player.of(interaction.guildId), parseInt(argument))));
                    }
                    break;
            }
        }
    });

    client.login(token);
})();
