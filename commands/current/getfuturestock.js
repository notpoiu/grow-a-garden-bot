import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder, MessageFlags } from "discord.js";
import { CreateStockEmbed, CreateText } from "../../utils/message.js";

const listToMap = (arr) => {
    const map = {};
    for (const e of arr) {
        map[e.item] = e.stock;
    }
    return map;
}

export default {
    data: new SlashCommandBuilder()
        .setName("getfuturestock")
        .setDescription("Predicts the next future stock for a chosen type (Seed, Gear or Egg)")
        .addStringOption(option =>
            option.setName("type")
                .setDescription("Which stock type to predict")
                .addChoices(
                    { name: "Seed", value: "Seed" },
                    { name: "Gear", value: "Gear" },
                    { name: "Egg", value: "Egg"}
                )
                .setRequired(true)
        )
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
        .setContexts(InteractionContextType.BotDM, InteractionContextType.PrivateChannel, InteractionContextType.Guild),

    async execute(interaction) {
        const type = interaction.options.getString("type");

        const prediction = await fetch(`${process.env.EXTERNAL_API_BASEURL}/api/v1/predict/NextRestock?type=${encodeURIComponent(type)}`, {
            method: "GET",
            headers: {
                "x-api-key": process.env.EXTERNAL_API_KEY
            },
        })

        if (!prediction.ok) {
            return await interaction.reply({
                content: `Error fetching data for "${type}".`,
                flags: MessageFlags.Ephemeral
            });
        }

        const Data = await prediction.json();
        const list = listToMap(Data.map(d => ({
            item: d.Name,
            stock: d.Stock
        })));

        const msg = CreateStockEmbed(type, list, interaction.channelId, "Future ", true);
        if (msg.components && msg.components[0])
            msg.components[0].addTextDisplayComponents(
                CreateText("-# This using a prediction algorithm and may not be 100% accurate!")
            )

        await interaction.reply(msg);
        return;
    },
}


