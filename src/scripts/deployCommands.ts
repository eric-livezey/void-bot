import { commands } from '../commands/index.js';
import { config } from '../config.js';

const { token, clientId } = config;
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
