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
    }
}