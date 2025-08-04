import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { Command } from "..";
import { CommandContext } from "../../context";

const embed = new EmbedBuilder().addFields(
    { name: "play *[query]", value: "Plays something from YouTube using the [query] as a link or search query. If any atachments are added, the bot will attempt to play them as audio, otherwise if no query is provided, attempts resume." },
    { name: "playmusic|playm|pm [query]", value: "Plays a song from YouTube using the [query] as a search query. Should only find official music in search results (not videos)." },
    { name: "playalbum|playa|pa [query]", value: "Queues every song in a album from YouTube based off of the search query." },
    { name: "pause", value: "Pauses the currently playing track." },
    { name: "resume", value: "Resumes the currently playing track." },
    { name: "skip", value: "Skips the currently playing track." },
    { name: "stop", value: "Stops the currently playing track and clears the queue." },
    { name: "nowplaying|np", value: "Displays the currently playing track." },
    { name: "queue|q", value: "Displays the queue." },
    { name: "connect|join *[voice_channel]", value: "Makes the bot join a voice channel, either [voice_channel] or your current voice channel." },
    { name: "disconnect|leave", value: "Makes the bot leave it's current voice channel." },
    { name: "remove|rm [index]", value: "Removes track [index] from the queue." },
    { name: "move|mv [source_index] [destination index]", value: "Moves the track at [source_index] to [destination_index]" },
    { name: "clear", value: "Clears the queue." },
    { name: "shuffle", value: "Shuffles the queue." },
    { name: "loop", value: "Loops the currently playing track." },
    { name: "info|i [index]", value: "Displays info about a queued track at [index] in the queue." },
    { name: "volume [percentage]", value: "Sets the volume to the specified percentage." },
    { name: "viewcount [url]", value: "Creates a channel which will track the views for the YouTube video referenced by [url]." },
    { name: "subcount [url]", value: "Creates a channel which will track the subscribers for the YouTube channel referenced by [url]." },
    { name: "evaluate|eval [expression]", value: 'Evaluates a methematic expression.' },
    { name: "help|h", value: "Displays this message." },
).toJSON();

export async function help(ctx: CommandContext) {
    await ctx.reply({ embeds: [embed] });
}

export default {
    interaction: {
        data: new SlashCommandBuilder()
            .setName('help')
            .setDescription('Displays a help message.'),
        execute: help,
    },
    message: [
        {
            aliases: ['help', 'h'],
            execute: help,
        }
    ]
} as Command;
