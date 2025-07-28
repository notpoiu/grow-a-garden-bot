import { SlashCommandBuilder, MessageFlags, StringSelectMenuBuilder, ActionRowBuilder } from "discord.js";
import { IsChannelSubscribed, AddReactionRoleMessage, AddPingRole, GetReactionRoleMessageInChannel, RemoveReactionRoleMessage } from "../../utils/db.js";
import { CreateEmbed, EmojiMappings } from "../../utils/message.js";
import { GetAllTrackers, GetSortedStockData, GetEmoji } from "../../utils/utils.js";

const StockChoices = GetAllTrackers(false) // Exclude Admin Restock from reaction roles
    .map(stock => ({
        name: stock,
        value: stock
    }));

export default {
    data: new SlashCommandBuilder()
        .setName("reactionroles")
        .setDescription("Set up reaction roles for stock pings (creates role if needed)")
        .addStringOption(option =>
            option.setName("stock")
                .setDescription("The stock to set up reaction roles for")
                .setRequired(true)
                .addChoices(
                    ...StockChoices
                )
        )
        .addChannelOption(option =>
            option.setName('tracking-channel')
                .setDescription('The channel where the tracking is set up')
                .setRequired(true)
        ),

    async execute(interaction) {
        // Check for permissions to manage roles
        if (!interaction.guild.members.me.permissions.has('ManageRoles')) {
            return await interaction.reply({
                components: [
                    CreateEmbed({
                        title: "Reaction Roles Setup",
                        description: "I do not have permission to manage roles in this server. Please grant me the 'Manage Roles' permission to set up reaction roles.",
                        footer: "Check my permissions and try again.",
                    })
                ],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
            });
        }

        // Check if the user has permission to manage roles
        if (!interaction.member.permissions.has('ManageRoles')) {
            return await interaction.reply({
                components: [
                    CreateEmbed({
                        title: "Reaction Roles Setup",
                        description: "You do not have permission to manage roles in this server. Please contact an admin to set up reaction roles.",
                        footer: "You can still set up reaction roles in channels you have permission to manage.",
                    })
                ],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
            });
        }

        const stock = interaction.options.getString("stock");
        const tracking_channel = interaction.options.getChannel("tracking-channel") || interaction.channel;

        if (!IsChannelSubscribed(tracking_channel.id, stock)) {
            return await interaction.reply({
                components: [
                    CreateEmbed({
                        title: "Reaction Roles Setup",
                        description: `You need to track the stock **${stock}** in ${tracking_channel} before setting up reaction roles. Use the /track command to start tracking this stock.`,
                        footer: "Once tracking is set up, you can create reaction roles for stock updates.",
                    })
                ],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
            });
        }

        // Build the select menu options based on the stock visibility data
        const OptionArray = GetSortedStockData(stock);
        const SelectOptions = [];

        for (const option of OptionArray) {
            SelectOptions.push({
                label: option,
                value: `reactionrole_${option}`,
                description: `Get notified when ${option} becomes available`,
                emoji: GetEmoji(option)
            });
        }

        // Split options into chunks of 25 (Discord's max limit for select menu options)
        const chunks = [];
        for (let i = 0; i < SelectOptions.length; i += 25) {
            chunks.push(SelectOptions.slice(i, i + 25));
        }

        // Create select menus for each chunk
        const actionRows = [];
        const embedComponent = CreateEmbed({
            title: `${EmojiMappings[stock] == undefined ? "" : EmojiMappings[stock] + " "}${stock} Reaction Roles`,
            description: `Select a role to receive notifications for ${stock} stock updates.${chunks.length > 1 ? `\n\n**Note:** Options are split across ${chunks.length} menus due to Discord's 25-option limit.` : ''}`,
        });

        chunks.forEach((chunk, index) => {
            const selectMenu = new StringSelectMenuBuilder()
                .setCustomId(`reactionrole_${stock}_${index}`)
                .setPlaceholder(`Select a reaction role ${chunks.length > 1 ? `(Menu ${index + 1}/${chunks.length})` : ''}`)
                .setMinValues(0)
                .setMaxValues(chunk.length)
                .addOptions(chunk);
            
            actionRows.push(new ActionRowBuilder().addComponents(selectMenu));
        });

        // Send the initial response
        const ExistingMessage = GetReactionRoleMessageInChannel(tracking_channel.id, stock)

        if (ExistingMessage && ExistingMessage.id && typeof ExistingMessage.id === "string") {
            RemoveReactionRoleMessage(ExistingMessage.id);
        }

        let message;
        try {
                message = await interaction.channel.send({
                    components: [
                    embedComponent,
                    ...actionRows
                ],
                flags: MessageFlags.IsComponentsV2
            });
        } catch (error) {
            return await interaction.reply({
                components: [
                    CreateEmbed({
                        title: "Reaction Roles Setup",
                        description: "Failed to send the reaction roles message. Please check my permissions in this channel and try again.",
                        footer: "I need permission to send messages and embed links in this channel.",
                    })
                ],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
            });
        }

        AddReactionRoleMessage(message.id, tracking_channel.id, stock);

        // Map existing roles to their stock names
        const dbRoles = interaction.guild.roles.cache.filter(role => {
            const roleName = role.name.toLowerCase();
            return roleName.includes('ping') && OptionArray.some(option => 
                roleName.includes(option.toLowerCase())
            );
        });

        const GetStockName = (roleName) => {
            const lowerRoleName = roleName.toLowerCase();
            return OptionArray.reduce((bestMatch, option) => {
                const lowerOption = option.toLowerCase();
                if (lowerRoleName.includes(lowerOption)) {
                    if (!bestMatch || lowerOption.length > bestMatch.length) {
                        return option;
                    }
                }
                return bestMatch;
            }, null);
        }

        for (const role of dbRoles.values()) {
            const stockName = GetStockName(role.name);
            if (!stockName) continue;

            AddPingRole(tracking_channel.id, role.id, stockName, stock);
        }

        await interaction.reply({
            components: [
                CreateEmbed({
                    title: "Reaction Roles Setup",
                    description: `Successfully set up reaction roles for **${stock}** in ${tracking_channel}. You can now select roles to receive notifications for stock updates.\n\n**[Automatic Role Mappings Detection]:**\n${dbRoles.length === 0 ? "*No Roles Detected*" : dbRoles.map(role => `${GetEmoji(GetStockName(role.name))}${GetStockName(role.name)} ↔ <@&${role.id}> (${role.name})`).join('\n')}`,
                    footer: "You can configure this further by using the /reactionroles manage command (coming soon).",
                })
            ],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
    }
}