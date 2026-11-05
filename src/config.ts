import { existsSync, readFileSync } from "node:fs";

/**
 * Config options.
 */
export interface ConfigOptions {
    /**
     * The bot's token.
     */
    readonly token?: string;
    /**
     * The bot's client ID.
     */
    readonly clientId?: string;
    /**
     * ID of a guild to install owner only commands in.
     */
    readonly guildId?: string;
    /**
     * ID of the owner of the bot.
     */
    readonly ownerId?: string;
    /**
     * ID of a text channel in which to forward direct messages to.
     */
    readonly dmChannelId?: string;
    /**
     * Prefix to use for message commands.
     */
    readonly prefix?: string;
}
const PATH = 'config.json';
export const config: ConfigOptions = Object.create(null);
if (existsSync(PATH)) {
    try {
        const data = JSON.parse(readFileSync(PATH).toString());
        let value;
        for (const key of ['token', 'clientId', 'guildId', 'ownerId', 'dmChannelId', 'prefix'] as const) {
            if (key in data && typeof (value = data[key]) === 'string') {
                Object.defineProperty(config, key, { value, enumerable: true });
            }
        }
    } catch (error) {
        console.error(error);
    }
}
Object.preventExtensions(config);
