import { InteractionContextType, PermissionsBitField, SlashCommandAttachmentOption, SlashCommandBuilder } from 'discord.js';
import { SlashCommandContext } from '../../context.js';
import type { Command } from '../index.js';
import { play } from './play.js';

const permissions = new PermissionsBitField([
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak
]).freeze();

export default {
    interaction: {
        data: new SlashCommandBuilder()
            .setName('play-file')
            .setDescription('Play an audio file.')
            .addAttachmentOption(new SlashCommandAttachmentOption()
                .setName('file')
                .setDescription('An audio file.')
                .setRequired(true))
            .setContexts(InteractionContextType.Guild)
            .setDefaultMemberPermissions(permissions.bitfield),
        async execute(ctx: SlashCommandContext<true>) {
            const attachment = ctx.interaction.options.getAttachment('file', true);

            await play(ctx, { attachment });
        }
    }
} satisfies Command<true>;
