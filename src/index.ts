import { AllowedMentionsTypes, Events, IntentsBitField, Message, type MessageCreateOptions, MessageFlags, type MessageMentionOptions, MessageMentions, MessagePayload, Partials, Poll, type PollData, userMention } from 'discord.js';
import { Client, commands } from './commands/index.js';
import { generateGuildsListMessage } from './commands/miscellaneous/guilds.js';
import { generateQueueMessage } from './commands/playback/queue.js';
import { Player } from './player.js';
import { TrackerManager } from './tracker.js';
import { type ConfigOptions, createVoiceConnection, normalizeOptions } from './utils.js';

import config from '../config.json' with { type: 'json' };

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
        answers: poll.answers.map(answer => (normalizeOptions({
            text: answer.text ?? '',
            emoji: answer.emoji?.identifier ?? undefined
        }))),
        duration: poll.expiresTimestamp ? Math.ceil((poll.expiresTimestamp - Date.now()) / 3.6e+6) : 24,
        allowMultiselect: poll.allowMultiselect,
        layoutType: poll.layoutType
    };
}

function _messageToCreateOptions(message: Message): MessageCreateOptions {
    return normalizeOptions({
        content: message.content,
        embeds: message.embeds.map(embed => embed.toJSON()),
        allowedMentions: _messageMentionsToOptions(message.mentions),
        files: message.attachments.map(attachment => attachment.url),
        components: message.components.map(component => component.toJSON()),
        poll: message.poll ? _pollToOptions(message.poll) : undefined,
        tts: message.tts,
        stickers: message.stickers.toJSON(),
        flags: message.flags.bitfield & (MessageFlags.SuppressEmbeds | MessageFlags.SuppressNotifications | MessageFlags.IsComponentsV2)
    });
}

// add date and time to logs
const log = console.log;
console.log = function (...data) { log(`[${new Date().toLocaleString()}]`, ...data) };

// config
const { token, dmChannelId } = config as ConfigOptions;
const isTokenSet = token != null;
const isDmChannelIdSet = dmChannelId != null;

if (!isTokenSet) {
    console.error('[ERROR]', "'token' is not set.");
    process.exit(1);
}

(async () => {

    // create the client
    const client = new Client({ intents: INTENTS, partials: PARTIALS }, commands);

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
            client.commands.messageCommands?.handleMessage(message);
        }
    });

    // when an interaction is created
    client.on(Events.InteractionCreate, async interaction => {
        if (interaction.isChatInputCommand()) {
            // interaction is a command, so let the manager handle it
            client.commands.slashCommands.handleCommandInteraction(interaction);
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
        } else if (interaction.isAutocomplete()) {
            // interaction is an autocomplete, so let the manager handle it
            client.commands.slashCommands.handleAutocompleteInteraction(interaction);
        }
    });

    client.login(token);
})();
