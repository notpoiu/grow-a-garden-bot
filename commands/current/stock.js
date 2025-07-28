import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder, MessageFlags } from "discord.js";
import { CreateStockEmbed } from "../../utils/message.js";
import { GetAllTimerTrackers } from "../../utils/utils.js";
import { GetCurrentStockData } from "../../utils/db.js";

const StockChoices = GetAllTimerTrackers()
    .map(stock => ({
        name: stock,
        value: stock
    }));

export default {
    data: new SlashCommandBuilder()
        .setName("currentstock")
        .setDescription("Gets the current stock data for a specific stock")
        .addStringOption(option =>
            option.setName("stock")
                .setDescription("The stock to get data for")
                .setRequired(true)
                .addChoices(
                    ...StockChoices
                )
        )
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
		.setContexts(InteractionContextType.BotDM, InteractionContextType.PrivateChannel, InteractionContextType.Guild),

    async execute(interaction) {
        const stock = interaction.options.getString("stock");
        const data = GetCurrentStockData(stock)

        return await interaction.reply(CreateStockEmbed(stock, data));
    }
}