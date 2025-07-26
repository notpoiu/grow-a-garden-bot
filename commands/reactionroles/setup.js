import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { CreateEmbed } from "../../utils/message.js";
import { GetAllTrackers } from "../../utils/utils.js";

const StockChoices = GetAllTrackers()
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
            option.setName('channel')
                .setDescription('The channel to setup reaction roles in (if not specified, the current channel will be used)')
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
        const channel = interaction.options.getChannel("channel") || interaction.channel;
    }
}