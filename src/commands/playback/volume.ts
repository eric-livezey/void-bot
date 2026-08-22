import { InteractionContextType, PermissionsBitField, SlashCommandBuilder, SlashCommandNumberOption } from 'discord.js';
import { MessageCommand, SlashCommand } from '../command.js';
import type { CommandContext, MessageCommandContext, SlashCommandContext } from '../commandContext.js';
import type { CommandManagers } from '../commandManager.js';

export default async function execute(ctx: CommandContext<true>, percentage: number): Promise<void> {
    const { player } = ctx;
    player.setVolume(percentage / 100);
    await ctx.reply(`Volume set to ${percentage}%.`);
}

const DEFAULT_MEMBER_PERMISSIONS = new PermissionsBitField([
    PermissionsBitField.Flags.Connect,
    PermissionsBitField.Flags.Speak
]).freeze();

const slashCommand = new SlashCommand<true>({
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Set the volume of the player.')
        .addNumberOption(new SlashCommandNumberOption()
            .setName('percentage')
            .setDescription('Volume percentage.')
            .setMinValue(0)
            .setRequired(true))
        .setContexts(InteractionContextType.Guild)
        .setDefaultMemberPermissions(DEFAULT_MEMBER_PERMISSIONS.bitfield),
    async execute(ctx: SlashCommandContext<true>): Promise<void> {
        const { options } = ctx.interaction;

        const percentage = options.getNumber('percentage', true);

        await execute(ctx, percentage);
    },
});
const messageCommand = new MessageCommand<true>({
    aliases: ['volume'],
    memberPermissions: DEFAULT_MEMBER_PERMISSIONS,
    dmPermission: false,
    async execute(ctx: MessageCommandContext<true>): Promise<void> {
        if (!ctx.member.permissions.has(DEFAULT_MEMBER_PERMISSIONS)) {
            await ctx.reply('You must have permission to connect and speak to use this command.');
            return;
        }

        const [input] = ctx.getArguments(1);

        if (!input) {
            await ctx.reply('`percentage` must be provided.');
            return;
        }

        if (!/^\d+(\.\d+)?$/.test(input)) {
            await ctx.reply('`percentage` must be a number.');
            return;
        }

        const percentage = parseFloat(input);

        if (percentage < 0) {
            await ctx.reply('`percentage` must be greater than or equal to 0.');
            return;
        }

        await execute(ctx, percentage);
    },

});

export function registerVolumeCommand({ slashCommands, messageCommands }: CommandManagers): void {
    slashCommands.register(slashCommand);
    messageCommands?.register(messageCommand);
}
