import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder, MessageFlags } from "discord.js";
import { CreateEmbed, EmojiMappings, ConnectorEmojis } from "../../utils/message.js";
import { GetCurrentStockData, GetEmojiForStock } from "../../utils/db.js";
import { GetAllTimerTrackers } from "../../utils/utils.js";

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
        
        const Data = GetCurrentStockData(stock)

        let Description = "";
        if (!Data || Object.keys(Data).length === 0) {
            Description = "No stock data available.";
        } else {
            Description = Object.entries(Data).map(([item_name, quantity], index) => {
                const connector = index === Object.keys(Data).length - 1 ? ConnectorEmojis.End : ConnectorEmojis.Connect;
                const emoji = GetEmojiForStock(item_name) || EmojiMappings[item_name] || "";
    
                return `${connector}**${emoji} ${item_name}** (x${quantity})`;
            }).join("\n")
        }

        return await interaction.reply({
            components: [
                CreateEmbed({
                    title: `${EmojiMappings[stock] == undefined ? "" : EmojiMappings[stock] + " "}${stock} Stock`,
                    description: Description,
                    footer: `This is stock as of <t:${Math.floor(Date.now() / 1000)}>`,
                    ActionRow: [
                        {
                            label: "Quick Join",
                            link: "https://externalrobloxjoiner.vercel.app/join?placeId=126884695634066"
                        }
                    ]
                })
            ],
            flags: MessageFlags.IsComponentsV2
        });
    }
}