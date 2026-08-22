import config from '../../config.json' with { type: 'json' };
import { commands } from '../commands/index.js';
import type { ConfigOptions } from '../utils.js';

const { token, clientId } = config as ConfigOptions;
const isTokenSet = token != null;
const isClientIdSet = clientId != null;

if (!isTokenSet || !isClientIdSet) {
    if (!isTokenSet) {
        console.error('[ERROR]', "'token' is not set.");
    }
    if (!isClientIdSet) {
        console.error('[ERROR]', "'clientId' is not set.");
    }
    process.exit(1);
}

commands.slashCommands.installCommands(token, clientId);
