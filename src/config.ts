import { existsSync, readFileSync } from "node:fs";

/**
 * Config options.
 */
export interface ConfigOptions {
    /**
     * The bot's token.
     */
    token?: string;
    /**
     * The bot's client ID.
     */
    clientId?: string;
    /**
     * ID of a guild to install owner only commands in.
     */
    guildId?: string;
    /**
     * ID of the owner of the bot.
     */
    ownerId?: string;
    /**
     * ID of a text channel in which to forward direct messages to.
     */
    dmChannelId?: string;
    /**
     * Prefix to use for message commands.
     */
    prefix?: string;
}
const PATH = 'config.json';
export const config: ConfigOptions = {};
if (existsSync(PATH)) {
    try {
        const data = JSON.parse(readFileSync(PATH).toString());
        let value;
        for (const key of ['token', 'clientId', 'guildId', 'ownerId', 'dmChannelId', 'prefix'] as const) {
            if (key in data && typeof (value = data[key]) === 'string') {
                config[key] = value;
            }
        }
    } catch { }
}
