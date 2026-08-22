import { Client as BaseClient, type ClientOptions } from 'discord.js';
import type { ConfigOptions } from '../utils.js';
import { type CommandManagers, MessageCommandManager, SlashCommandManager } from './commandManager.js';
import { registerDmCommand } from './messaging/dm.js';
import { registerSendCommand } from './messaging/send.js';
import { registerEvaluateCommand } from './miscellaneous/evaluate.js';
import { registerExecuteCommand } from './miscellaneous/execute.js';
import { registerExecutePrettyCommand } from './miscellaneous/executepretty.js';
import { registerGuildsCommand } from './miscellaneous/guilds.js';
import { registerHelpCommand } from './miscellaneous/help.js';
import { registerClearCommand } from './playback/clear.js';
import { registerInfoCommand } from './playback/info.js';
import { registerJoinCommand } from './playback/join.js';
import { registerLeaveCommand } from './playback/leave.js';
import { registerLoopCommand } from './playback/loop.js';
import { registerMoveCommand } from './playback/move.js';
import { registerNowPlayingCommand } from './playback/nowplaying.js';
import { registerPauseCommand } from './playback/pause.js';
import { registerPlayCommand } from './playback/play.js';
import { registerPlayAlbumCommand } from './playback/playalbum.js';
import { registerPlayFileCommand } from './playback/playfile.js';
import { registerPlayMusicCommand } from './playback/playmusic.js';
import { registerQueueCommand } from './playback/queue.js';
import { registerRemoveCommand } from './playback/remove.js';
import { registerResumeCommand } from './playback/resume.js';
import { registerShuffleCommand } from './playback/shuffle.js';
import { registerSkipCommand } from './playback/skip.js';
import { registerStopCommand } from './playback/stop.js';
import { registerVolumeCommand } from './playback/volume.js';
import { registerSubscriberCountCommand } from './tracking/subscribercount.js';
import { registerViewCountCommand } from './tracking/viewcount.js';

import config from '../../config.json' with { type: 'json' };

const { prefix: PREFIX } = config as ConfigOptions;

export const commands = { slashCommands: new SlashCommandManager(), messageCommands: PREFIX != null ? new MessageCommandManager(PREFIX) : null } satisfies CommandManagers;

registerDmCommand(commands);
registerSendCommand(commands);
registerEvaluateCommand(commands);
registerExecuteCommand(commands);
registerExecutePrettyCommand(commands);
registerGuildsCommand(commands);
registerHelpCommand(commands);
registerClearCommand(commands);
registerInfoCommand(commands);
registerJoinCommand(commands);
registerLeaveCommand(commands);
registerLoopCommand(commands);
registerMoveCommand(commands);
registerNowPlayingCommand(commands);
registerPauseCommand(commands)
registerPlayCommand(commands);
registerPlayAlbumCommand(commands);
registerPlayFileCommand(commands);
registerPlayMusicCommand(commands);
registerQueueCommand(commands);
registerRemoveCommand(commands);
registerResumeCommand(commands);
registerShuffleCommand(commands);
registerSkipCommand(commands);
registerStopCommand(commands);
registerVolumeCommand(commands);
registerSubscriberCountCommand(commands);
registerViewCountCommand(commands);

/**
 * Client with commands.
 */
export class Client<Ready extends boolean> extends BaseClient<Ready> {
    public readonly commands: CommandManagers;

    constructor(options: ClientOptions, commands: CommandManagers) {
        super(options);
        this.commands = commands;
    }
}
