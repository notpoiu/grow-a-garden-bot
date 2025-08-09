import { ApplicationIntegrationType, InteractionContextType, SlashCommandBuilder, MessageFlags } from "discord.js";
import { CreateEmbed, ConnectorEmojis, EmojiMappings, CreateText } from "../../utils/message.js";
import { PredictStockOccurences } from "../../utils/predictors/stock.js";
import { GetEmojiForStock, GetShopVisibilityData, GetStockData } from "../../utils/db.js";

export default {
    data: new SlashCommandBuilder()
        .setName("getstockoccurrences")
        .setDescription("Finds next occurrences for a seed or gear")
        .addStringOption(option =>
            option.setName("seed")
                .setDescription("Seed name")
                .setAutocomplete(true)
                .setRequired(false)
        )
        .addStringOption(option =>
            option.setName("gear")
                .setDescription("Gear name")
                .setAutocomplete(true)
                .setRequired(false)
        )
        .addIntegerOption(option =>
            option.setName("max")
                .setDescription("Max occurrences to search (1-15)")
                .setRequired(false)
                .setMinValue(1)
                .setMaxValue(15)
        )
        .setIntegrationTypes(ApplicationIntegrationType.UserInstall, ApplicationIntegrationType.GuildInstall)
        .setContexts(InteractionContextType.BotDM, InteractionContextType.PrivateChannel, InteractionContextType.Guild),

    async execute(interaction) {
        const seedName = interaction.options.getString("seed");
        const gearName = interaction.options.getString("gear");
        const max = interaction.options.getInteger("max") || 5;

        const provided = [!!seedName, !!gearName].filter(Boolean).length;
        if (provided !== 1) {
            return await interaction.reply({
                content: "Please provide exactly one of: seed or gear.",
                flags: MessageFlags.Ephemeral
            });
        }

        const type = seedName ? "Seed" : "Gear";
        const itemName = seedName || gearName;
        const occ = PredictStockOccurences(type, itemName, max);

        if (!occ || occ.length === 0) {
            return await interaction.reply({
                content: `No future occurrences found for "${itemName}" within search limits.`,
                flags: MessageFlags.Ephemeral
            });
        }

        const emoji = GetEmojiForStock(itemName) || EmojiMappings[itemName] || "";
        const lines = occ.map((o, idx) => {
            const when = o.unix ? `<t:${o.unix}:f> (<t:${o.unix}:R>)` : `${o.restocks} restock(s) away`;
            return `- **${emoji ? emoji + " " : ""}${itemName}** (x${o.stock})\n   - ${when}`;
        }).join("\n");

        const embed = CreateEmbed({
            title: `Future Occurrences (${type})`,
            description: lines,
        });

        embed.addTextDisplayComponents(
            CreateText("-# This using a prediction algorithm and may not be 100% accurate!")
        )

        return await interaction.reply({
            components: [embed],
            flags: MessageFlags.IsComponentsV2
        });
    },

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused(true);
        const query = (focused.value || "").toString().toLowerCase();
        const isSeed = focused.name === "seed";
        const type = isSeed ? "Seed" : "Gear";

        let rows = [];
        try {
            rows = GetShopVisibilityData(type) || [];
        } catch (_) {}

        const suggestions = rows
            .filter(r => !query || r.toLowerCase().includes(query))
            .slice(0, 25)
            .map(r => ({ name: r, value: r }));

        await interaction.respond(suggestions);
    }
}



