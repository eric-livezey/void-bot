import { Attachment, InteractionContextType, PermissionsBitField, SlashCommandAttachmentOption, SlashCommandBuilder } from 'discord.js';
import { SlashCommand } from '../command.js';
import { CommandContext, SlashCommandContext } from '../commandContext.js';
import type { CommandManagers } from '../commandManager.js';
import play from './play.js';

export default async function execute(ctx: CommandContext<true>, attachment: Attachment): Promise<void> {
    await play(ctx, { attachment });
}

const DEFAULT_MEMBER_PERMISSIONS = new PermissionsBitField([
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak
]).freeze();

const slashCommand = new SlashCommand<true>({
    data: new SlashCommandBuilder()
        .setName('play-file')
        .setDescription('Play an audio file.')
        .addAttachmentOption(new SlashCommandAttachmentOption()
            .setName('file')
            .setDescription('An audio file.')
            .setRequired(true))
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(DEFAULT_MEMBER_PERMISSIONS.bitfield),
    async execute(ctx: SlashCommandContext<true>): Promise<void> {
        await execute(ctx, ctx.interaction.options.getAttachment('file', true));
    }
});

export function registerPlayFileCommand({ slashCommands }: CommandManagers) {
    slashCommands.register(slashCommand);
}
