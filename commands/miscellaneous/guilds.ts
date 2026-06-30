import { ActionRowBuilder, type APIMessageTopLevelComponent, AutocompleteInteraction, ButtonBuilder, ButtonStyle, Collection, ContainerBuilder, Guild, type JSONEncodable, type MessageActionRowComponentBuilder, MessageFlags, type MessagePayloadOption, PermissionsBitField, type RESTPostAPIChannelInviteJSONBody, type RESTPostAPIChannelInviteResult, RouteBases, Routes, SlashCommandBuilder, SlashCommandIntegerOption, SlashCommandStringOption, SlashCommandSubcommandBuilder, SlashCommandUserOption, type Snowflake, TextDisplayBuilder } from 'discord.js';
import { CommandContext, MessageCommandContext, SlashCommandContext } from '../../context.js';
import type { Command } from '../index.js';

const MAX_PAGE_SIZE = 25;

export function generateGuildsListMessage(guilds: Collection<Snowflake, Guild>, page: number = 0): MessagePayloadOption {
    const maxPage = Math.ceil(guilds.size / MAX_PAGE_SIZE) - 1;
    page = Math.max(Math.min(maxPage, page), 0);
    const components: JSONEncodable<APIMessageTopLevelComponent>[] = [
        new ContainerBuilder()
            .addTextDisplayComponents(
                new TextDisplayBuilder()
                    .setContent(
                        [
                            '# Guilds',
                            guilds.values()
                                .drop(page * MAX_PAGE_SIZE)
                                .take(MAX_PAGE_SIZE)
                                .map(guild => `- [${guild.name}](https://discord.com/channels/${guild.id})`)
                                .reduce((text, line) => text + '\n' + line),
                            `-# ${guilds.size} Items`,
                            ...maxPage > 0 ? [`-# Page ${page + 1}/${maxPage + 1}`] : []
                        ].join('\n')
                    )
            )
    ];
    const buttons = [];
    if (page > 0) {
        buttons.push(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('\u2b05')
                .setCustomId(`GUILDS_LIST_PAGE:${page - 1}`)
        );
    }
    if (guilds.size > (page + 1) * MAX_PAGE_SIZE) {
        buttons.push(
            new ButtonBuilder()
                .setStyle(ButtonStyle.Secondary)
                .setEmoji('\u27a1')
                .setCustomId(`GUILDS_LIST_PAGE:${page + 1}`)
        );
    }
    if (buttons.length > 0) {
        components.push(
            new ActionRowBuilder<MessageActionRowComponentBuilder>()
                .addComponents(...buttons)
        );
    }
    return {
        flags: MessageFlags.IsComponentsV2,
        components
    };
}

async function handleGuildsList(ctx: CommandContext): Promise<void> {
    await ctx.reply(generateGuildsListMessage(ctx.client.guilds.cache));
}

async function handleGuildsInvite(ctx: CommandContext, guildId: Snowflake, maxAge?: number, maxUses?: number, userIds?: Snowflake[]): Promise<void> {
    const guild = ctx.client.guilds.cache.get(guildId);
    if (!guild) {
        await ctx.reply('The guild is inaccessible.');
        return;
    }
    const me = await guild.members.fetchMe();
    const channel = guild.systemChannel ?? guild.channels.cache
        .filter(
            channel => (channel.isTextBased() || channel.isVoiceBased()) && !channel.isThread()
        )
        .find(channel => channel.permissionsFor(me).has(PermissionsBitField.Flags.CreateInstantInvite));
    if (!channel) {
        await ctx.reply('The bot cannot create an invite.');
        return;
    }
    try {
        let url: string;
        if (userIds) {
            const res = await ctx.client.rest.post(
                Routes.channelInvites(channel.id),
                {
                    body: {
                        max_age: maxAge,
                        max_uses: maxUses
                    } satisfies RESTPostAPIChannelInviteJSONBody,
                    files: [{
                        contentType: 'text/csv',
                        data: ['user_id', ...userIds].join('\n'),
                        name: 'target_users.csv'
                    }]
                }
            ) as RESTPostAPIChannelInviteResult;
            url = `${RouteBases.invite}/${res.code}`;
        } else {
            const invite = await guild.invites.create(channel, { maxAge, maxUses });
            url = invite.url;
        }
        await ctx.reply(url);
    } catch (error) {
        console.error(error);
        await ctx.reply({ flags: MessageFlags.Ephemeral, content: 'The bot failed to create an invite' });
    }
}

async function handleGuildsLeave(ctx: CommandContext, guildId: Snowflake): Promise<void> {
    const guild = ctx.client.guilds.cache.get(guildId);
    if (!guild) {
        await ctx.reply('The guild is inaccessible.');
        return;
    }
    await guild.leave();
    ctx.reply(`Left **${guild.name}**`);
}

const PERMISSIONS = new PermissionsBitField([
    PermissionsBitField.Flags.Administrator
]).freeze();

export default {
    interaction: {
        isGuildCommand: true,
        data: new SlashCommandBuilder()
            .setName('guilds')
            .setDescription('Manage guilds.')
            .setDefaultMemberPermissions(PERMISSIONS.bitfield)
            .addSubcommand(
                new SlashCommandSubcommandBuilder()
                    .setName('list')
                    .setDescription('List guilds which the bot is a member of.')
            )
            .addSubcommand(
                new SlashCommandSubcommandBuilder()
                    .setName('invite')
                    .setDescription('Get an invite to a guild.')
                    .addStringOption(
                        new SlashCommandStringOption()
                            .setName('guild')
                            .setDescription('A guild ID.')
                            .setAutocomplete(true)
                            .setRequired(true)
                    )
                    .addIntegerOption(
                        new SlashCommandIntegerOption()
                            .setName('max-age')
                            .setDescription('The duration of the invite in seconds before expiry, or 0 for never.')
                            .setMinValue(0)
                            .setMaxValue(604800)
                    )
                    .addIntegerOption(
                        new SlashCommandIntegerOption()
                            .setName('max-uses')
                            .setDescription('The maximum number of uses or 0 for unlimited.')
                            .setMinValue(0)
                            .setMaxValue(100)
                    )
                    .addUserOption(
                        new SlashCommandUserOption()
                            .setName('target-user')
                            .setDescription('User allowed to accept the invite.')
                    )
            )
            .addSubcommand(
                new SlashCommandSubcommandBuilder()
                    .setName('leave')
                    .setDescription('Make the bot leave a guild.')
                    .addStringOption(
                        new SlashCommandStringOption()
                            .setName('guild')
                            .setDescription('A guild ID.')
                            .setAutocomplete(true)
                            .setRequired(true)
                    )
            ),
        async execute(ctx: SlashCommandContext): Promise<void> {
            const options = ctx.interaction.options;
            switch (options.getSubcommand(true)) {
                case 'list':
                    await handleGuildsList(ctx);
                    break;
                case 'invite':
                    await handleGuildsInvite(
                        ctx,
                        options.getString('guild', true),
                        options.getInteger('max-age') ?? undefined,
                        options.getInteger('max-uses') ?? undefined,
                        options.getUser('target-user')?.id.split(',')
                    );
                    break;
                case 'leave':
                    await handleGuildsLeave(ctx, options.getString('guild', true));
                    break;
            }
        },
        async autocomplete(interaction: AutocompleteInteraction) {
            const input = interaction.options.getFocused().toLowerCase();
            await interaction.respond(
                interaction.client.guilds.cache.values()
                    .filter(guild => guild.name.toLowerCase().startsWith(input))
                    .map(guild => ({ name: guild.name, value: guild.id }))
                    .toArray()
            );
        }
    },
    message: [
        {
            isOwnerOnly: true,
            aliases: ['guilds'],
            requiredPermissions: PERMISSIONS,
            async execute(ctx: MessageCommandContext): Promise<void> {
                const [subcommand, guildId] = ctx.getArguments(2);
                if (!subcommand) {
                    await ctx.reply('`subcommand` is required.');
                    return;
                }
                switch (subcommand) {
                    case 'list':
                        await handleGuildsList(ctx);
                        break;
                    case 'invite':
                        if (!guildId) {
                            await ctx.reply('`guildId` is required.');
                            return;
                        }
                        await handleGuildsInvite(ctx, guildId);
                        break;
                    case 'leave':
                        if (!guildId) {
                            await ctx.reply('`guildId` is required.');
                            return;
                        }
                        await handleGuildsLeave(ctx, guildId);
                        break;
                    default:
                        await ctx.reply('Invalid subcommand. Subcommand should be one of `list`, `invite`, or `leave`.');
                }

            }
        }
    ]
} satisfies Command;
