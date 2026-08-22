import { MessageFlags, PermissionsBitField, SlashCommandAttachmentOption, SlashCommandBuilder, SlashCommandStringOption, SlashCommandUserOption, User, type MessageCreateOptions } from 'discord.js';
import { normalizeOptions, resolveUserId, type ConfigOptions } from '../../utils.js';
import { MessageCommand, SlashCommand } from '../command.js';
import { CommandContext, MessageCommandContext, SlashCommandContext } from '../commandContext.js';
import type { CommandManagers } from '../commandManager.js';

import config from '../../../config.json' with { type: 'json' };

const { guildId: GUILD_ID } = config as ConfigOptions;

export default async function execute(ctx: CommandContext, user: User, options: MessageCreateOptions): Promise<void> {
    try {
        if (ctx.isSlashCommand()) {
            await ctx.deferReply();
        }
        const channel = await user.createDM();
        await channel.send(options);
        await ctx.reply(options);
    } catch (error) {
        await ctx.replyOrFollowUp({ flags: MessageFlags.Ephemeral, content: (Error.isError(error) ? error.message : String(error)) + '.' });
    }
}

const slashCommand = new SlashCommand({
    data: new SlashCommandBuilder()
        .setName('dm')
        .setDescription('Send a direct message.')
        .addUserOption(new SlashCommandUserOption()
            .setName('user')
            .setDescription('The user to DM.')
            .setRequired(true))
        .addStringOption(new SlashCommandStringOption()
            .setName('content')
            .setDescription('Message content')
            .setMaxLength(2000))
        .addAttachmentOption(new SlashCommandAttachmentOption()
            .setName('attachment')
            .setDescription('Message attachment'))
        .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
    async execute(ctx: SlashCommandContext): Promise<void> {
        const options = ctx.interaction.options;

        const user = options.getUser('user', true);
        const content = options.getString('content') ?? undefined;
        const attachments = [];
        const attachment = options.getAttachment('attachment') ?? undefined;
        if (attachment) {
            attachments.push(attachment);
        }

        await execute(ctx, user, normalizeOptions({ content, files: attachments.map(attachment => attachment.url) }));
    }
});
const messageCommand = new MessageCommand({
    aliases: ['dm'],
    ownerOnly: true,
    async execute(ctx: MessageCommandContext): Promise<void> {
        const [userParam, content] = ctx.getArguments(2);
        const attachments = ctx.message.attachments;

        if (!userParam) {
            await ctx.reply('You must provide a text channel.');
            return;
        }

        const userId = resolveUserId(userParam);
        const user = userId ? ctx.client.users.resolve(userId) : null;

        if (!user) {
            await ctx.reply('The first argument must reference a valid user.');
            return;
        }

        await execute(ctx, user, normalizeOptions({ content, files: attachments.map(attachment => attachment.url) }));
    }
});

export function registerDmCommand({ slashCommands, messageCommands }: CommandManagers): void {
    if (GUILD_ID != null) {
        slashCommands.register(slashCommand, { global: false, guildIds: [GUILD_ID] });
    }
    messageCommands?.register(messageCommand);
}
