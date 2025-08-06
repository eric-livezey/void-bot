import { InteractionContextType, PermissionsBitField, SlashCommandAttachmentOption, SlashCommandBuilder } from 'discord.js';
import { Command } from '..';
import { InteractionContext } from '../../context';
import { play } from './play';

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
        async execute(ctx: InteractionContext<true>) {
            const attachment = ctx.interaction.options.getAttachment('file', true);

            await play(ctx, { attachment });
        }
    }
} as Command;
