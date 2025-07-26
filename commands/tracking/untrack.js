import { SlashCommandBuilder, MessageFlags } from "discord.js";
import { CreateEmbed } from "../../utils/message.js";
import { GetAllTrackers } from "../../utils/utils.js";
import { RemoveSubscribedChannel } from "../../utils/db.js";

const StockChoices = GetAllTrackers()
    .map(stock => ({
        name: stock,
        value: stock
    }));

export default {
    data: new SlashCommandBuilder()
        .setName("untrack")
        .setDescription("Stops tracking a stock")
        .addStringOption(option =>
            option.setName("stock")
                .setDescription("The stock to stop tracking")
                .setRequired(true)
                .addChoices(
                    ...StockChoices
                )
        )
        .addChannelOption(option =>
            option.setName('channel')
                .setDescription('The channel to stop tracking the stock in (if not specified, the current channel will be used)')
        ),

    async execute(interaction) {
        const stock = interaction.options.getString("stock");
        const channel = interaction.options.getChannel("channel") || interaction.channel;

        // Check if the user has permission to manage channels
        if (!interaction.member.permissions.has('ManageChannels')) {
            return await interaction.reply({
                components: [
                    CreateEmbed({
                        title: "Tracking Setup",
                        description: "You do not have permission to manage channels in this server. Please contact an admin to set up tracking.",
                        footer: "You can still track stocks in channels you have permission to manage.",
                    })
                ],
                flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
            });
        }

        RemoveSubscribedChannel(channel.id, stock);

        return await interaction.reply({
            components: [
                CreateEmbed({
                    title: "Tracking Setup",
                    description: `Successfully stopped tracking **${stock}** in ${channel}. You will no longer receive notifications for restocks in this channel.`,
                    footer: "You can start tracking this stock again using the /track command.",
                })
            ],
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
        });
    }
}