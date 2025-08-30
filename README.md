# Void Bot

Void bot is a discord bot which will play videos from YouTube is discord voice channels. Void bot is built in node using [discord.js](https://github.com/discordjs/discord.js). It also uses [YouTube.js](https://github.com/LuanRT/YouTube.js) and [yt-dlp](https://github.com/yt-dlp/yt-dlp) to get youtube metadata and download videos respectively.

## Usage

### Prerequisites

- [Node.js](https://nodejs.org/en/download).
- [yt-dlp](https://github.com/yt-dlp/yt-dlp?tab=readme-ov-file#installation)
- You need to create a discord bot if you do not already have one you can create one [here](https://discord.com/developers/applications).

### Setup

Then if you want to build this project, you first need to clone it:

```bash
git clone https://github.com/eric-livezey/void-bot.git
```

Then navigate to the folder in a terminal run the following command:

```bash
npm i
```

You will then need to create a file called `config.json` in the folder.

The file should look like this:

```jsonc
{
  "token": "YOUR_TOKEN", // your bot's token
  "clientId": "YOUR_CLIENT_ID", // your bot's client ID
  "guildId": "GUILD_ID", // the ID of the guild you want to use for guild commmands
  "ownerId": "YOUR_USER_ID", // your user ID
  "dmChannelId": "DM_CHANNEL_ID", // channel which bot DMs should be sent to
  "prefix": "." // prefix for message commands
}
```

### Launching

Once you've done that you should be able to run the following command to launch the bot:

```bash
npm start
```

The bot should then be running. You can see a list of message commands by typing `.help` in a channel with the bot. It will have a different prefix if you changed it.

### Application Commands

In order for application commands to work your bot needs to have them installed. Simply run the following command to install the application commands:

```bash
npm run deploy-commands
```
